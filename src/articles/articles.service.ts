import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { getS3Url, transformObject } from 'src/utils/functions/misc.functions';
import { CreateArticleDto } from './dto/create-article.dto';

import axios from 'axios';
import { Response } from 'express';
import { htmlToText } from 'html-to-text';
import { MediaService } from 'src/media/media.service';
import { formatDocuments } from 'src/utils/functions/helper.functions';
import { addS3Url } from 'src/utils/functions/transformS3';
import { GenerateArticlesExcelDto } from './dto/genearte-excel.dto';
import { GenerateArticlesPdfDto } from './dto/generate-pdf.dto';
import { GetAllArticlesDto } from './dto/get-all-articles.dto';
import { GetAllCompanyArticlesDto } from './dto/get-all-company-articles.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleTableTransformer } from './entities/article.entity';
import {
  ARTICLES_HEADERS,
  CONTACTS_HEADERS,
  DetailedArticleExcelTransformer,
} from './entities/articleExcel.entity';
import { CompanyArticleTableTransformer } from './entities/companyArticle.entity';
import { DetailedArticleTransformer } from './entities/detailedArticle.entity';

import PDFDocument from 'pdfkit';
import path, { resolve } from 'path';
import * as _sharp from 'sharp';
const sharp = (_sharp as any).default || _sharp;
import { applyWatermark } from 'src/utils/functions/watermark';
import { keepOnlyPages } from 'src/companies/utils/pdf.functions';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mediaService: MediaService,
  ) {}

  private readonly wpURL = process.env.WP_API_URL;
  private readonly username = process.env.WP_API_USERNAME;
  private readonly password = process.env.WP_API_PASSWORD;

  // Helper to get base WordPress URL from custom endpoint
  private get wpBaseUrl(): string {
    if (!this.wpURL) return '';
    // Extract base URL from custom endpoint (e.g., https://staging.ismomat.fr/wp-json/custom/v1/products -> https://staging.ismomat.fr)
    const match = this.wpURL.match(/(https?:\/\/[^\/]+)/);
    return match ? match[1] : '';
  }

  private get wpAuthToken(): string {
    return `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
  }

  // Sync category or section to WordPress/WooCommerce
  private async syncTermToWordPress(termName: string): Promise<void> {
    if (!this.wpBaseUrl || !this.username || !this.password) {
      console.warn('WordPress credentials not configured, skipping sync');
      return;
    }

    try {
      const wcApiUrl = `${this.wpBaseUrl}/wp-json/wc/v3/products/categories`;
      
      // Check if category already exists in WordPress
      const existingCategoriesResponse = await axios.get(wcApiUrl, {
        headers: {
          Authorization: this.wpAuthToken,
        },
        params: {
          search: termName,
          per_page: 100,
        },
      });

      const existingCategory = existingCategoriesResponse.data.find(
        (cat: any) => cat.name.toLowerCase() === termName.toLowerCase(),
      );

      if (existingCategory) {
        console.log(`Category "${termName}" already exists in WordPress (ID: ${existingCategory.id})`);
        return;
      }

      // Create new category in WordPress
      const response = await axios.post(
        wcApiUrl,
        { name: termName },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.wpAuthToken,
          },
        },
      );

      console.log(`Successfully synced category "${termName}" to WordPress (ID: ${response.data.id})`);
    } catch (error) {
      console.error(`Failed to sync category "${termName}" to WordPress:`, error.response?.data || error.message);
      // Don't throw - we don't want to break the article creation/update if WordPress sync fails
    }
  }

  // Sync a single article as a WooCommerce product
  private async syncArticleToWordPress(articleId: number): Promise<void> {
    if (!this.wpBaseUrl || !this.username || !this.password) {
      console.warn('WordPress credentials not configured, skipping product sync');
      return;
    }

    try {
      const article = await this.db.article.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          title: true,
          description: true,
          reference: true,
          category: { select: { name: true } },
          section: { select: { name: true } },
          photos: { select: { url: true } },
        },
      });

      if (!article) return;

      // Collect category names from both category and section
      const categoryNames: string[] = [];
      if (article.category?.name) categoryNames.push(article.category.name);
      if (article.section?.name) categoryNames.push(article.section.name);

      // Get or create WooCommerce category IDs
      const wcCategoryIds: number[] = [];
      for (const name of categoryNames) {
        const wcCatId = await this.getOrCreateWpCategory(name);
        if (wcCatId) wcCategoryIds.push(wcCatId);
      }

      // Download photos, apply watermark, re-upload to S3, and pass S3 URLs
      const photos: { src: string }[] = [];
      for (const photo of article.photos) {
        try {
          const s3Url = getS3Url('documents/' + photo.url);
          const response = await axios.get(s3Url, { responseType: 'arraybuffer' });
          const watermarked = await applyWatermark(Buffer.from(response.data));
          const filename = photo.url.split('/').pop() || `article-${articleId}.jpg`;
          const uploadedPath = await this.mediaService.uploadFile(
            watermarked,
            filename,
            'watermarked',
          );
          photos.push({ src: getS3Url(uploadedPath) });
        } catch (err) {
          console.error(`Failed to watermark photo ${photo.url}:`, err.message);
          photos.push({ src: getS3Url('documents/' + photo.url) });
        }
      }

      const wcApiUrl = `${this.wpBaseUrl}/wp-json/wc/v3/products`;

      // Check if product already exists by SKU (reference)
      const existingProducts = await axios.get(wcApiUrl, {
        headers: { Authorization: this.wpAuthToken },
        params: { sku: article.reference || `PROD-${article.id}` },
      });

      const productData: any = {
        name: article.title || '',
        description: article.description || '',
        sku: article.reference || `PROD-${article.id}`,
        categories: wcCategoryIds.map((id) => ({ id })),
        images: photos,
      };

      if (existingProducts.data?.length > 0) {
        // Update existing product
        const wpProductId = existingProducts.data[0].id;
        await axios.put(`${wcApiUrl}/${wpProductId}`, productData, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.wpAuthToken,
          },
        });
        console.log(`Updated product "${article.title}" in WordPress (ID: ${wpProductId})`);
      } else {
        // Create new product
        const response = await axios.post(wcApiUrl, productData, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.wpAuthToken,
          },
        });
        console.log(`Created product "${article.title}" in WordPress (ID: ${response.data.id})`);
      }
    } catch (error) {
      console.error(`Failed to sync article to WordPress:`, error.response?.data || error.message);
    }
  }

  // Get or create a WooCommerce category by name, return its WP ID
  private async getOrCreateWpCategory(name: string): Promise<number | null> {
    try {
      const wcApiUrl = `${this.wpBaseUrl}/wp-json/wc/v3/products/categories`;

      const existing = await axios.get(wcApiUrl, {
        headers: { Authorization: this.wpAuthToken },
        params: { search: name, per_page: 100 },
      });

      const found = existing.data.find(
        (cat: any) => cat.name.toLowerCase() === name.toLowerCase(),
      );

      if (found) return found.id;

      const created = await axios.post(wcApiUrl, { name }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.wpAuthToken,
        },
      });

      return created.data.id;
    } catch (error) {
      console.error(`Failed to get/create WP category "${name}":`, error.response?.data || error.message);
      return null;
    }
  }

  // Remove a product from WordPress by SKU
  private async removeArticleFromWordPress(sku: string, title: string): Promise<void> {
    if (!this.wpBaseUrl || !this.username || !this.password) return;

    try {
      const wcApiUrl = `${this.wpBaseUrl}/wp-json/wc/v3/products`;

      const existingProducts = await axios.get(wcApiUrl, {
        headers: { Authorization: this.wpAuthToken },
        params: { sku },
      });

      if (existingProducts.data?.length > 0) {
        const wpProductId = existingProducts.data[0].id;
        await axios.delete(`${wcApiUrl}/${wpProductId}`, {
          headers: { Authorization: this.wpAuthToken },
          params: { force: true },
        });
        console.log(`Removed product "${title}" from WordPress (ID: ${wpProductId})`);
      }
    } catch (error) {
      console.error(`Failed to remove product from WordPress:`, error.response?.data || error.message);
    }
  }

  async removeCategory(id: number) {
    const category = await this.db.category.findUnique({ where: { id } });
    if (!category) throw new Error('Category not found');

    // Disconnect articles from this category
    await this.db.article.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });

    // Disconnect companies from this category
    await this.db.company.updateMany({
      where: { categories: { some: { id } } },
      data: {},
    });
    // Remove the many-to-many relation entries
    await this.db.category.update({
      where: { id },
      data: { companies: { set: [] } },
    });

    // Remove from WordPress
    await this.removeWpCategory(category.name);

    return this.db.category.delete({ where: { id } });
  }

  private async removeWpCategory(categoryName: string): Promise<void> {
    if (!this.wpBaseUrl || !this.username || !this.password) return;

    try {
      const wcApiUrl = `${this.wpBaseUrl}/wp-json/wc/v3/products/categories`;
      const existing = await axios.get(wcApiUrl, {
        headers: { Authorization: this.wpAuthToken },
        params: { search: categoryName, per_page: 100 },
      });

      const found = existing.data.find(
        (cat: any) => cat.name.toLowerCase() === categoryName.toLowerCase(),
      );

      if (found) {
        await axios.delete(`${wcApiUrl}/${found.id}`, {
          headers: { Authorization: this.wpAuthToken },
          params: { force: true },
        });
        console.log(`Removed category "${categoryName}" from WordPress (ID: ${found.id})`);
      }
    } catch (error) {
      console.error(`Failed to remove WP category "${categoryName}":`, error.response?.data || error.message);
    }
  }

  private async handleCategoryConnection(
    category: { id?: number; name?: string },
    newArticleData: Prisma.ArticleCreateInput | Prisma.ArticleUpdateInput,
  ) {
    if (!category.name) {
      return (newArticleData.category = { connect: { id: category.id } });
    }

    const categoryExists = await this.db.category.findFirst({
      where: { name: category.name, articles: { some: {} } },
    });

    if (categoryExists) {
      return (newArticleData.category = {
        connect: { id: categoryExists.id },
      });
    }

    newArticleData.category = {
      create: { name: category.name },
    };

    // Sync new category to WordPress
    await this.syncTermToWordPress(category.name);
  }
  private async handleSectionConnection(
    section: { id?: number; name?: string },
    newArticleData: Prisma.ArticleCreateInput | Prisma.ArticleUpdateInput,
  ) {
    if (!section.name) {
      return (newArticleData.section = { connect: { id: section.id } });
    }

    const sectionExists = await this.db.section.findFirst({
      where: { name: section.name, articles: { some: {} } },
    });
    console.log({ sectionExists });
    if (sectionExists) {
      return (newArticleData.section = {
        connect: { id: sectionExists.id },
      });
    }

    newArticleData.section = {
      create: { name: section.name },
    };

    // Sync new section to WordPress
    await this.syncTermToWordPress(section.name);

    console.log({ sectionData: newArticleData.section });
  }

  async create(createArticleDto: CreateArticleDto) {
    const { category, industry, section, company, photos, ...data } =
      createArticleDto;

    if (!category && !section)
      throw new Error(
        'Au moins une des cases Rubrique OU Catégorie doit être renseignée',
      );

    const industryExists = await this.db.industry.findFirst({
      where: { name: industry.name, articles: { some: {} } },
    });

    const formattedPhotos = formatDocuments(photos);

    const newArticleData: Prisma.ArticleCreateInput = {
      ...data,
      company: { connect: { id: company } },
      industry: industry.name
        ? industryExists
          ? { connect: { id: industryExists.id } }
          : { create: { name: industry.name } }
        : { connect: { id: industry.id } },
    };

    if (category) {
      await this.handleCategoryConnection(category, newArticleData);
    }

    if (section) {
      await this.handleSectionConnection(section, newArticleData);
    }

    const newArticle = await this.db.article.create({
      data: newArticleData,
    });

    const updatedArticle = await this.db.article.update({
      where: { id: newArticle.id },
      data: {
        reference: `PROD-${newArticle.id}`,
      },
    });
    await Promise.all(
      formattedPhotos.toBeUpdated.map(async (doc) => {
        await this.db.document.update({
          where: { id: doc.id },
          data: {
            name: doc.name,
            description: doc.description,
            url: doc.url,
          },
        });
      }),
    );
    await Promise.all(
      formattedPhotos.toBeAdded.map(async (doc) => {
        await this.db.document.create({
          data: {
            name: doc.name,
            description: doc.description,
            url: doc.url,
            articleId: newArticle.id,
          },
        });
      }),
    );

    await Promise.all(
      formattedPhotos.toBeDeleted.map(async (doc) => {
        await this.db.document.delete({ where: { id: doc.id } });
      }),
    );

    // Auto-sync article to WordPress
    this.syncArticleToWordPress(newArticle.id).catch((err) =>
      console.error('Background WordPress sync failed:', err),
    );

    return updatedArticle;
  }

  private _generateFilters(payload: GetAllArticlesDto) {
    const { key, order, search, title, include: _, ...rest } = payload;

    const orderBy: Prisma.ArticleOrderByWithRelationInput = {};
    const where: Prisma.ArticleWhereInput = {};
    const filters: Prisma.ArticleWhereInput = {};

    switch (key) {
      case 'category':
        orderBy.category = { name: order };
        break;
      case 'section':
        orderBy.section = { name: order };
        break;
      case 'companyName':
        orderBy.company = { companyName: order };
        break;
      case 'companyCountry':
        orderBy.company = { country: order };
        break;
      case 'companyCity':
        orderBy.company = { city: order };
        break;
      default:
        orderBy[key] = order;
        break;
    }

    for (const [key, value] of Object.entries(rest)) {
      switch (key) {
        case 'equipmentCondition':
          if (typeof value === 'string') filters.equipmentCondition = value;
          break;
        case 'section':
          if (typeof value === 'number') filters.sectionId = value;
          break;
        case 'industry':
          if (typeof value === 'number') filters.industryId = value;
          break;
        case 'category':
          if (typeof value === 'number') filters.categoryId = value;
          break;
        case 'reference':
          if (typeof value === 'string') filters.reference = value;
          break;
        case 'companyName':
          if (typeof value === 'string')
            filters.company = { companyName: value };
          break;
        case 'companyCountry':
          if (typeof value === 'string') filters.company = { country: value };
          break;
        case 'companyCity':
          if (typeof value === 'string') filters.company = { city: value };
          break;
        case 'isCompleted':
          if (typeof value === 'string') {
            if (value === 'true') filters.isCompleted = true;
            if (value === 'false') filters.isCompleted = false;
          }
          break;
        default:
          if (typeof value === 'number') filters[key] = value;
          break;
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { equipmentCondition: { contains: search, mode: 'insensitive' } },
        {
          company: {
            companyName: { contains: search, mode: 'insensitive' },
            country: { contains: search, mode: 'insensitive' },
            city: { contains: search, mode: 'insensitive' },
          },
        },
        {
          category: { name: { contains: search, mode: 'insensitive' } },
        },
        {
          section: { name: { contains: search, mode: 'insensitive' } },
        },
      ];
    }

    if (title) {
      where.OR = [
        ...(where.OR || []),
        { title: { contains: title, mode: 'insensitive' } },
      ];
    }

    return { filters, where, orderBy };
  }

  async findAll(payload: GetAllArticlesDto) {
    const { offset, limit, ...rest } = payload;

    const { filters, where, orderBy } = this._generateFilters(rest);

    const data = await this.db.article.findMany({
      skip: offset * limit,
      take: limit,
      where: {
        AND: [filters, ...(!!Object.keys(where).length ? [where] : [])],
      },
      orderBy: Object.values(orderBy).filter((v) => v).length
        ? orderBy
        : { createdAt: 'desc' },
      include: {
        photos: true,
        company: true,
        category: true,
        industry: true,
        section: true,
      },
    });

    const count = await this.db.article.count({
      where: {
        AND: [filters, ...(!!Object.keys(where).length ? [where] : [])],
      },
    });

    return { data: transformObject(data, ArticleTableTransformer), count };
  }

  async synchronizeShowcaseArticles(payload: { selectedIds: number[] }) {
    try {
      await this.db.article.updateMany({
        where: { id: { in: payload.selectedIds } },
        data: { showOnWebsite: true },
      });

      const data = await this.db.article.findMany({
        where: { showOnWebsite: true },
        select: {
          id: true,
          title: true,
          description: true,
          reference: true,
          category: { select: { name: true } },
          section: { select: { name: true } },
          photos: { select: { url: true } },
        },
      });

      const showcaseArticles = data.map((photo) => ({
        ...photo,
        photos: photo.photos.map(({ url }) => getS3Url('documents/' + url)),
      }));

      const token = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;

      await axios.post(this.wpURL, showcaseArticles, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
        },
      });

      return true;
    } catch (error) {
      return error;
    }
  }

  async getAllCompanyArticles(payload: GetAllCompanyArticlesDto) {
    const { offset, limit, companyId, search, key, order } = payload;

    const orderBy: Prisma.ArticleOrderByWithRelationInput = {};
    const where: Prisma.ArticleWhereInput = {};

    orderBy[key] = order;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { equipmentCondition: { contains: search, mode: 'insensitive' } },
      ];
    }

    const articles = await this.db.article.findMany({
      skip: offset * limit,
      take: limit,
      where: {
        company: { id: companyId },
        AND: [...(!!Object.keys(where).length ? [where] : [])],
      },
      orderBy: { [key]: order },
    });

    const count = await this.db.article.count({
      where: {
        company: { id: companyId },
        AND: [...(!!Object.keys(where).length ? [where] : [])],
      },
    });

    return {
      data: transformObject(articles, CompanyArticleTableTransformer),
      count,
    };
  }

  private _filtersMapper(obj: { id: number; name: string }[]) {
    return obj.map(({ id, name }) => ({ value: id, label: name }));
  }

  async getFilterOptions() {
    const res = await Promise.allSettled([
      this.db.category.findMany({
        orderBy: { name: 'asc' },
      }),
      this.db.industry.findMany({
        orderBy: { name: 'asc' },
      }),
      this.db.section.findMany({
        orderBy: { name: 'asc' },
      }),

      this.db.contactOrigin.findMany({ orderBy: { name: 'asc' } }),
    ]);

    const companies = await this.db.company.findMany({
      select: { id: true, companyName: true },
      orderBy: { companyName: 'asc' },
    });
    const articles = await this.db.article.findMany({
      distinct: ['equipmentCondition'],
      select: { id: true, equipmentCondition: true, reference: true },
      orderBy: { equipmentCondition: 'asc' },
    });

    const [categories, industries, sections] = res.map((data) =>
      data.status === 'fulfilled' ? data.value : [],
    );

    return {
      categories: this._filtersMapper(categories),
      industries: this._filtersMapper(industries),
      sections: this._filtersMapper(sections),
      references: articles.map(({ reference }) => ({
        value: reference,
        label: reference,
      })),
      companyNames: companies.map(({ companyName }) => ({
        value: companyName,
        label: companyName,
      })),
      equipmentCondition: articles
        .filter(({ equipmentCondition }) => equipmentCondition)
        .map(({ equipmentCondition }) => ({
          value: equipmentCondition,
          label: equipmentCondition,
        })),
    };
  }

  async findOne(id: number) {
    // do something about the photos
    const article = await this.db.article.findUnique({
      where: { id },
      include: {
        photos: {
          select: { id: true, name: true, url: true, description: true },
        },
        category: { select: { id: true, name: true } },
        industry: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });

    return DetailedArticleTransformer(article);
  }

  async generateExcelData(payload: GenerateArticlesExcelDto) {
    const { selectedIds, ...rest } = payload;

    const { filters, where } = this._generateFilters(rest);

    const data = await this.db.article.findMany({
      where: {
        AND: [
          ...(!!selectedIds.length ? [{ id: { in: selectedIds } }] : []),
          filters,
          ...(!!Object.keys(where).length ? [where] : []),
        ],
      },
      select: {
        title: true,
        reference: true,
        equipmentCondition: true,
        availability: true,
        createdAt: true,
        updatedAt: true,
        company: {
          select: {
            companyName: true,
            country: true,
            city: true,
            code: true,
            zipCode: true,
            address: true,
            contacts: {
              select: {
                gender: true,
                firstName: true,
                lastName: true,
                functionality: true,
                note: true,
                phoneNumber: true,
                hasWhatsapp: true,
              },
            },
          },
        },
        industry: { select: { name: true } },
        category: { select: { name: true } },
        section: { select: { name: true } },
        purchasePriceWithoutTVA: true,
        purchasePriceWithTVA: true,
        sellingPriceWithoutTVA: true,
        sellingPriceWithTVA: true,
        marginRate: true,
        HSCode: true,
      },
    });

    const transformedData = transformObject(
      data,
      DetailedArticleExcelTransformer,
    );

    const maxContacts = Math.max(
      ...transformedData.map(({ contacts }) => contacts.length),
    );

    const articlesData = transformedData.map(({ contacts, ...article }) => ({
      ...article,
      ...contacts.reduce(
        (acc, contact, index) => ({
          ...acc,
          [`Contact ${index + 1}_firstName`]: contact.firstName,
          [`Contact ${index + 1}_lastName`]: contact.lastName,
          [`Contact ${index + 1}_gender`]: contact.gender,
          [`Contact ${index + 1}_functionality`]: contact.functionality,
          [`Contact ${index + 1}_phoneNumber`]: contact.phoneNumber,
          [`Contact ${index + 1}_note`]: contact.note,
          [`Contact ${index + 1}_hasWhatsapp`]: contact.hasWhatsapp,
        }),
        {},
      ),
    }));

    const GENERATED_HEADERS = {
      ...ARTICLES_HEADERS,
      ...Array.from({ length: maxContacts }).reduce<Record<string, string>>(
        (acc, _, index) => {
          acc[`Contact ${index + 1}_firstName`] = `Contact ${index + 1} Prénom`;
          acc[`Contact ${index + 1}_lastName`] = `Contact ${index + 1} Nom`;
          acc[`Contact ${index + 1}_gender`] = `Contact ${index + 1} Civilitie`;
          acc[`Contact ${index + 1}_functionality`] =
            `Contact ${index + 1} Fonctionnalité`;
          acc[`Contact ${index + 1}_phoneNumber`] = `Contact ${index + 1} GSM`;
          acc[`Contact ${index + 1}_note`] = `Contact ${index + 1} Note`;
          acc[`Contact ${index + 1}_hasWhatsapp`] =
            `Contact ${index + 1} Whatsapp`;
          return acc;
        },
        {} as Record<string, string>,
      ),
    };

    // const contactsData = transformedData
    //   .map(({ contacts }) => contacts)
    //   .reduce((acc, contacts) => {
    //     if (!contacts.length) return acc;
    //     return {
    //       ...acc,
    //       [`Contacts - ${contacts[0].companyName}`]: {
    //         headers: CONTACTS_HEADERS,
    //         data: contacts.map(({ companyName: _, ...contact }) => ({
    //           ...contact,
    //         })),
    //       },
    //     };
    //   }, {});

    return {
      dataSheets: {
        articles: {
          headers: GENERATED_HEADERS,
          data: articlesData,
        },
        // ...contactsData,
      },
    };
  }

  async update(id: number, updateArticleDto: UpdateArticleDto) {
    const { industry, category, section, company, photos, ...data } =
      updateArticleDto;

    const formattedPhotos = formatDocuments(photos);

    const industryExists = await this.db.industry.findFirst({
      where: { name: industry.name, articles: { some: {} } },
    });

    const updatedArticleData: Prisma.ArticleUpdateInput = {
      ...data,
      company: { connect: { id: company } },
      industry: industry.name
        ? industryExists
          ? { connect: { id: industryExists.id } }
          : { create: { name: industry.name } }
        : { connect: { id: industry.id } },
    };

    if (category) {
      await this.handleCategoryConnection(category, updatedArticleData);
    }

    if (section) {
      await this.handleSectionConnection(section, updatedArticleData);
    }

    console.log({ sectionTest: updatedArticleData.section });

    const updatedArticle = await this.db.article.update({
      where: { id },
      data: updatedArticleData,
      include: {
        section: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        industry: { select: { id: true, name: true } },
        photos: {
          select: { id: true, name: true, url: true, description: true },
        },
      },
    });

    await Promise.all(
      formattedPhotos.toBeUpdated.map(async (doc) => {
        await this.db.document.update({
          where: { id: doc.id },
          data: {
            name: doc.name,
            description: doc.description,
            url: doc.url,
          },
        });
      }),
    );
    await Promise.all(
      formattedPhotos.toBeAdded.map(async (doc) => {
        await this.db.document.create({
          data: {
            name: doc.name,
            description: doc.description,
            url: doc.url,
            articleId: id,
          },
        });
      }),
    );

    await Promise.all(
      formattedPhotos.toBeDeleted.map(async (doc) => {
        await this.db.document.delete({ where: { id: doc.id } });
      }),
    );

    // Auto-sync article to WordPress
    this.syncArticleToWordPress(id).catch((err) =>
      console.error('Background WordPress sync failed:', err),
    );

    return DetailedArticleTransformer(updatedArticle);
  }

  private _drawImageWatermarkOverlay(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const savedX = doc.x;
    const savedY = doc.y;
    const text = 'ISMO';
    const fontSize = 28;
    const spacingX = 120;
    const spacingY = 80;

    const diagonal = Math.sqrt(w * w + h * h);
    const offsetX = (diagonal - w) / 2;
    const offsetY = (diagonal - h) / 2;

    doc.save();
    doc.rect(x, y, w, h).clip();
    doc.opacity(0.22);
    doc.font('Bold').fontSize(fontSize).fillColor('#D1D5DB');

    for (let gy = y - offsetY; gy < y + h + offsetY; gy += spacingY) {
      for (let gx = x - offsetX; gx < x + w + offsetX; gx += spacingX) {
        doc.save();
        doc.translate(gx, gy);
        doc.rotate(-45);
        doc.text(text, 0, 0, { lineBreak: false });
        doc.x = 0;
        doc.y = 0;
        doc.restore();
      }
    }

    doc.restore();
    doc.x = savedX;
    doc.y = savedY;
  }

  private _drawDiagonalWatermark(doc: PDFKit.PDFDocument): void {
    const savedX = doc.x;
    const savedY = doc.y;
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const text = 'ISMO';
    const fontSize = 36;
    const spacingX = 150;
    const spacingY = 100;

    const diagonal = Math.sqrt(pageW * pageW + pageH * pageH);
    const offsetX = (diagonal - pageW) / 2;
    const offsetY = (diagonal - pageH) / 2;

    doc.save();
    doc.opacity(0.07);
    doc.font('Bold').fontSize(fontSize).fillColor('#6B7280');

    for (let gy = -offsetY; gy < pageH + offsetY; gy += spacingY) {
      for (let gx = -offsetX; gx < pageW + offsetX; gx += spacingX) {
        doc.save();
        // Translate to the tile position, then rotate — draw at (0,0) so
        // doc.y stays at 0 and never triggers PDFKit's auto page-break.
        doc.translate(gx, gy);
        doc.rotate(-45);
        doc.text(text, 0, 0, { lineBreak: false });
        doc.x = 0;
        doc.y = 0;
        doc.restore();
      }
    }

    doc.restore();
    doc.x = savedX;
    doc.y = savedY;
  }

  private _drawPageWatermark(doc: PDFKit.PDFDocument, watermarkPath: string): void {
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const wmSize = 760;
    const wmX = pageW - wmSize + 30; // shifted right, slightly off-edge
    const wmY = Math.round((pageH - wmSize) / 2);
    doc.save();
    doc.opacity(0.13);
    doc.image(watermarkPath, wmX, wmY, { width: wmSize, height: wmSize });
    doc.restore();
  }

  private _drawHeader(doc: PDFKit.PDFDocument, logoPath: string, isFirstPage = false): void {
    // Bigger logo on the left
    doc.image(logoPath, 40, 15, { width: 230 });

    // Right contact text only — top-aligned with logo (y=15)
    const rightX = doc.page.width - 230;
    doc.font('Bold').fontSize(10).fillColor('#0A2D6E');
    doc.text('ISMO SARL - ZEKRI', rightX, 15, { align: 'right', width: 200 });
    doc.font('Regular').fontSize(10).fillColor('#000000');
    doc.text('Contact :', rightX, 30, { align: 'right', width: 200 });
    doc.text('+33 6 74 30 85 55', rightX, 45, { align: 'right', width: 200 });
    doc.text('info@ismomat.fr', rightX, 60, { align: 'right', width: 200 });

    // Title banner on first page only — narrower, centered (65% of page width)
    if (isFirstPage) {
      const bannerW = Math.round(doc.page.width * 0.65);
      const bannerX = Math.round((doc.page.width - bannerW) / 2);
      const bannerY = 100;
      const bannerH = 35;

      // Dashed rounded rectangle
      doc
        .roundedRect(bannerX, bannerY, bannerW, bannerH, 15)
        .dash(5, { space: 3 })
        .strokeColor('#0A2D6E')
        .lineWidth(1.5)
        .stroke()
        .undash();

      // Title text — centered inside banner
      doc
        .font('Bold')
        .fontSize(14)
        .fillColor('#0A2D6E')
        .text('List of the equipments on sale', bannerX, bannerY + 10, {
          width: bannerW,
          align: 'center',
        });

      // Date on the right edge of the banner
      const today = new Date();
      const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
      doc
        .font('Regular')
        .fontSize(10)
        .fillColor('#000')
        .text(dateStr, bannerX + bannerW - 110, bannerY + 12, {
          width: 100,
          align: 'right',
        });

      // Orange line same width as banner
      const lineY = bannerY + bannerH + 10;
      doc
        .moveTo(bannerX, lineY)
        .lineTo(bannerX + bannerW, lineY)
        .strokeColor('#F59E0B')
        .lineWidth(2)
        .stroke();
    }
  }

  private async _fetchImageBuffer(
    url: string,
    folder = 'documents',
  ): Promise<Buffer> {
    const fullUrl = addS3Url(url, folder);
    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async _drawRoundedImage(
     doc: PDFKit.PDFDocument,
     buffer: Buffer,
     x: number,
     y: number,
     w: number,
     h: number,
     radius: number = 8
  ) {
     const roundedW = Math.round(w * 2);
     const roundedH = Math.round(h * 2);

     // Step 1: always resize to exact target dimensions (cover crop) — guarantees correct aspect ratio
     let imgBuffer = buffer;
     try {
        imgBuffer = await sharp(buffer)
          .rotate()
          .resize(roundedW, roundedH, { fit: 'cover' })
          .png()
          .toBuffer();
     } catch (_) {
        // keep original if sharp fails entirely
     }

     // Step 2: apply rounded corners mask
     try {
        const r = Math.round(radius * 2);
        const mask = Buffer.from(
          `<svg width="${roundedW}" height="${roundedH}">
            <rect x="0" y="0" width="${roundedW}" height="${roundedH}" rx="${r}" ry="${r}" fill="white"/>
          </svg>`
        );
        imgBuffer = await sharp(imgBuffer)
          .resize(roundedW, roundedH, { fit: 'cover' })
          .composite([{ input: mask, blend: 'dest-in' }])
          .png()
          .toBuffer();
     } catch (_) {}

     // Clip to exact box so image always fills full width regardless of buffer aspect ratio
     doc.save();
     doc.rect(x, y, w, h).clip();
     doc.image(imgBuffer, x, y, { width: w });
     doc.restore();

     // Draw diagonal ISMO watermark over the image
     this._drawImageWatermarkOverlay(doc, x, y, w, h);
  }

  private async _drawArticleBlock(
     doc: PDFKit.PDFDocument,
     article: any,
     y: number,
     index: number = 0,
     isCatalogue: boolean = false
  ): Promise<number> {
     const startY = y;
     const pageMargin = 45;
     const contentW = doc.page.width - pageMargin * 2;
     const gap = 20;
     const imgColW = 245;
     const textColW = contentW - imgColW - gap;
     const imgRadius = 10;

     // Alternate layout: even index = images LEFT, text RIGHT; odd = text LEFT, images RIGHT
     const imagesOnLeft = index % 2 === 0;
     const imgColX = imagesOnLeft ? pageMargin : pageMargin + textColW + gap;
     const textColX = imagesOnLeft ? pageMargin + imgColW + gap : pageMargin;

     // --- Text Column ---
     let textY = y;

     // Merged Reference + Title Box
     const refText = article.reference || 'REF';
     const refLineH = 16;
     doc.font('Bold').fontSize(12);
     const titleTextH = doc.heightOfString(article.title, { width: textColW - 20 });
     const combinedBoxH = Math.max(refLineH + titleTextH + 10, 40);
     doc.roundedRect(textColX, textY, textColW, combinedBoxH, 8).fill('#D1D5DB');
     // Reference code at top-left inside box
     doc.fillColor('#374151').font('Bold').fontSize(8).text(refText, textColX + 10, textY + 6, { width: textColW - 20, lineBreak: false });
     // Title below reference
     doc.fillColor('#000').font('Bold').fontSize(12).text(article.title, textColX + 10, textY + refLineH + 6, { width: textColW - 20, lineBreak: true });

     textY += combinedBoxH + 12;

     // Description
     const rawDesc = isCatalogue ? (article.catalogDescription || '') : (article.description || '');
     const descText = htmlToText(rawDesc, { wordwrap: 130 });
     if (descText.trim()) {
        // In catalogue mode, cap description height so it doesn't overflow into the footer zone
        const footerZone = 60;
        const maxDescH = isCatalogue
          ? Math.max(0, (doc.page.height - footerZone) - textY - 60) // leave ~60pt for price + ref/date below
          : Infinity;
        const fullDescH = doc.heightOfString(descText, { width: textColW });
        if (fullDescH <= maxDescH || !isCatalogue) {
          doc.fillColor('#000').font('Regular').fontSize(9).text(descText, textColX, textY, { width: textColW, align: 'justify' });
          textY += fullDescH + 12;
        } else {
          // Render with clipped height in catalogue mode
          doc.fillColor('#000').font('Regular').fontSize(9).text(descText, textColX, textY, { width: textColW, align: 'justify', height: maxDescH, ellipsis: true });
          textY += maxDescH + 12;
        }
     }

     // Reference Parc
     doc.font('Regular').fontSize(9).fillColor('#000').text(`Référence parc : ${article.id}`, textColX, textY);
     textY += 15;

     // Date
     const year = article.createdAt ? new Date(article.createdAt).getFullYear() : '';
     if (year) {
        doc.text(`Date : ${year}`, textColX, textY);
        textY += 15;
     }

     textY += 8;

     // Price Button
     const price = article.sellingPriceWithoutTVA;
     const priceText = price && price > 0 ? `${price.toLocaleString('fr-FR')} € HT` : 'Price upon request';

     const btnW = price && price > 0 ? 90 : 130;
     doc.roundedRect(textColX, textY, btnW, 24, 8).fill('#F59E0B');
     doc.fillColor('#FFFFFF').font('Bold').fontSize(10).text(priceText, textColX, textY + 6, { width: btnW, align: 'center' });

     textY += 34;

     // --- Image Column ---
     // Only include renderable image files (exclude PDFs and other non-image types)
     const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'];
     const photos = article.photos
       .filter(p => imageExtensions.includes(path.extname(p.url).toLowerCase()))
       .slice(0, 3);
     const imgGap = 8;
     const photoW = Math.floor((imgColW - imgGap) / 2);

     // Calculate text block height for image sizing/centering
     const textBlockH = textY - startY;
     let imgY = y;

     // Available vertical space from y down to footer zone
     const footerReserve = 65;
     const availH = doc.page.height - footerReserve - y;

     console.log(`[CAT] article="${article.reference}" photos=${photos.length} y=${y} availH=${availH} textBlockH=${textBlockH} imgColX=${imgColX} imgColW=${imgColW}`);

     if (isCatalogue) {
        const n = photos.length;

        if (n === 3) {
           // Triangle layout: 2 small side-by-side on top, 1 full-width on bottom
           const smallW = Math.floor((imgColW - imgGap) / 2);
           const smallH = Math.min(
             Math.round(smallW * 3 / 4),
             Math.floor((availH - imgGap * 2) * 0.42),
           );
           const largeH = Math.min(
             Math.round(imgColW * 9 / 16),
             Math.floor((availH - imgGap * 2) * 0.56),
           );
           console.log(`[CAT] n=3 triangle: smallW=${smallW} smallH=${smallH} largeH=${largeH} imgY=${imgY}`);
           // Row 1: two images side by side
           for (let i = 0; i < 2; i++) {
              try {
                 const buf = await this._fetchImageBuffer(photos[i].url);
                 await this._drawRoundedImage(doc, buf, imgColX + i * (smallW + imgGap), imgY, smallW, smallH, imgRadius);
              } catch (_) {}
           }
           imgY += smallH + imgGap;
           // Row 2: one full-width image
           try {
              const buf = await this._fetchImageBuffer(photos[2].url);
              await this._drawRoundedImage(doc, buf, imgColX, imgY, imgColW, largeH, imgRadius);
           } catch (_) {}
           imgY += largeH;
        } else {
           // 1 or 2 photos: stack vertically at full column width
           const totalGaps = (n - 1) * imgGap;
           const imgH = Math.min(
             Math.round(imgColW * 9 / 16),
             Math.floor((availH - totalGaps) / n),
           );
           console.log(`[CAT] n=${n} stacked: imgH=${imgH} imgY=${imgY} availH=${availH}`);
           for (let i = 0; i < n; i++) {
              try {
                 const buf = await this._fetchImageBuffer(photos[i].url);
                 await this._drawRoundedImage(doc, buf, imgColX, imgY, imgColW, imgH, imgRadius);
              } catch (_) {}
              imgY += imgH + imgGap;
           }
        }
     } else {
        for (let i = 0; i < photos.length; i++) {
           try {
              const buffer = await this._fetchImageBuffer(photos[i].url);
              if (photos.length === 1) {
                 await this._drawRoundedImage(doc, buffer, imgColX, y, imgColW, textBlockH, imgRadius);
                 imgY = y + textBlockH;
              } else if (photos.length === 2) {
                 // Stack vertically at full column width
                 const twoH = Math.round(Math.min(imgColW * 9 / 16, Math.floor((availH - imgGap) / 2)));
                 if (i === 0) {
                   await this._drawRoundedImage(doc, buffer, imgColX, y, imgColW, twoH, imgRadius);
                   imgY = y + twoH + imgGap;
                 } else {
                   await this._drawRoundedImage(doc, buffer, imgColX, imgY, imgColW, twoH, imgRadius);
                   imgY += twoH;
                 }
              } else {
                 const threeH = Math.round(Math.min(textBlockH * 0.43, 85));
                 if (i < 2) {
                    const xPos = i === 0 ? imgColX : imgColX + photoW + imgGap;
                    await this._drawRoundedImage(doc, buffer, xPos, imgY, photoW, threeH, imgRadius);
                 } else {
                    imgY += threeH + imgGap;
                    const centeredX = imgColX + (imgColW - photoW) / 2;
                    await this._drawRoundedImage(doc, buffer, centeredX, imgY, photoW, threeH, imgRadius);
                    imgY += threeH + imgGap;
                 }
              }
           } catch (_) {}
        }
     }

     const maxBlockHeight = Math.max(textBlockH, imgY - startY);
     return maxBlockHeight + 15; // Add bottom padding
  }

  private _drawFooter(doc: PDFKit.PDFDocument, currentPage: number, totalPages: number) {
    // Save state
    const savedY = doc.y;
    const savedX = doc.x;
    const savedBottomMargin = doc.page.margins.bottom;

    // Disable bottom margin so text near page bottom doesn't trigger auto-page-break
    doc.page.margins.bottom = 0;

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const footerY = pageH - 55;

    // Line 1: Company capital
    doc
      .font('Regular')
      .fontSize(8)
      .fillColor('#6B7280')
      .text(
        'ISMO - SARL au capital de 7622,45€',
        45, footerY + 5,
        { align: 'center', width: pageW - 90, lineBreak: false },
      );

    // Line 2: Siret / TVA
    doc
      .font('Regular')
      .fontSize(8)
      .fillColor('#6B7280')
      .text(
        'N° Siret : 39274880200023 - TVA intracommunautaire : FR28392748802',
        45, footerY + 17,
        { align: 'center', width: pageW - 90, lineBreak: false },
      );

    // Line 3: Address
    doc
      .font('Regular')
      .fontSize(8)
      .fillColor('#6B7280')
      .text(
        '108 av. Pierre brossolette 92240 MALAKOFF FRANCE',
        45, footerY + 29,
        { align: 'center', width: pageW - 90, lineBreak: false },
      );

    // Page number bottom-right
    doc
      .font('Regular')
      .fontSize(8)
      .fillColor('#6B7280')
      .text(
        `${currentPage}/${totalPages}`,
        pageW - 90, footerY + 17,
        { align: 'right', width: 45, lineBreak: false },
      );

    // Restore state
    doc.page.margins.bottom = savedBottomMargin;
    doc.y = savedY;
    doc.x = savedX;
  }

  async generateCataloguePdf(
    payload: GenerateArticlesPdfDto,
    response?: Response,
  ): Promise<Buffer> {
    const isCatalogue = true;
    const { articleIds } = payload;
    const logoPath = path.join(__dirname, '../images/ismo-logo-full.png');
    const watermarkPath = path.join(__dirname, '../images/watermark.jpeg');

    const articles = await this.db.article.findMany({
      where: { id: { in: articleIds } },
      include: {
        photos: { select: { name: true, description: true, url: true } },
      },
      orderBy: { id: 'asc' }
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 45, bufferPages: true });
      const chunks: Uint8Array[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', (err) => reject(err));

      doc.registerFont('Regular', path.join(__dirname, '../assets/Roboto-Regular.ttf'));
      doc.registerFont('Bold', path.join(__dirname, '../assets/Roboto-Bold.ttf'));

      let currentY = 180; // Header + title banner height + extra spacing
      const pagesWithContent = new Set<number>([0]); // Track pages that have article content
      let currentPageIndex = 0;

      (async () => {
        try {
          // Initial Header with title banner
          this._drawHeader(doc, logoPath, true);

          for (let i = 0; i < articles.length; i++) {
            const article = articles[i];

            // Estimate min height needed (text-only ~160, with images ~200)
            const hasPhotos = article.photos && article.photos.length > 0;
            const minHeightNeeded = hasPhotos ? 200 : 160;
            const footerZone = 60; // Reserve space for footer

            console.log(`[CAT] article[${i}] ref="${article.reference}" currentY=${currentY} minHeightNeeded=${minHeightNeeded} pageH=${doc.page.height} threshold=${doc.page.height - footerZone}`);
            if (currentY + minHeightNeeded > doc.page.height - footerZone) {
               console.log(`[CAT] adding page before article[${i}], currentPageIndex=${currentPageIndex} → ${currentPageIndex + 1}`);
               doc.addPage();
               currentPageIndex++;
               this._drawHeader(doc, logoPath, false);
               currentY = 120;
            }

            pagesWithContent.add(currentPageIndex);

            // Draw content
            const heightUsed = await this._drawArticleBlock(doc, article, currentY, i, isCatalogue);
            currentY += heightUsed;

            // Separator (unless last or end of page)
            if (i < articles.length - 1) {
               if (currentY + 20 < doc.page.height - 60) {
                 const sepW = Math.round(doc.page.width * 0.65);
               const sepX = Math.round((doc.page.width - sepW) / 2);
               doc
                   .moveTo(sepX, currentY)
                   .lineTo(sepX + sepW, currentY)
                   .strokeColor('#F59E0B')
                   .lineWidth(2)
                   .stroke();
                 currentY += 30; // Margin after separator
               } else {
                 doc.addPage();
                 currentPageIndex++;
                 this._drawHeader(doc, logoPath, false);
                 currentY = 120;
               }
            }
          }

          // Draw footer on every buffered page using bufferedPageRange for correct indexing
          const range = doc.bufferedPageRange();
          const totalPages = range.count;
          const pageW = doc.page.width;
          const pageH = doc.page.height;
          const footerY = pageH - 55;
          console.log(`[FOOTER] range.start=${range.start} totalPages=${totalPages} pageH=${pageH} footerY=${footerY}`);
          for (let i = 0; i < totalPages; i++) {
            console.log(`[FOOTER] drawing footer on page index ${i} (buffered page ${range.start + i}), label=${i + 1}/${totalPages}`);
            doc.switchToPage(range.start + i);
            doc.x = doc.page.margins.left;
            doc.y = doc.page.margins.top;
            console.log(`[FOOTER] after switchToPage: doc.page.height=${doc.page.height} doc.y=${doc.y} margins.bottom=${doc.page.margins.bottom}`);
            this._drawPageWatermark(doc, watermarkPath);
            doc.page.margins.bottom = 0;
            doc.font('Regular').fontSize(8).fillColor('#6B7280')
              .text('ISMO - SARL au capital de 7622,45€', 45, footerY + 5, { align: 'center', width: pageW - 90, lineBreak: false });
            doc.font('Regular').fontSize(8).fillColor('#6B7280')
              .text('N° Siret : 39274880200023 - TVA intracommunautaire : FR28392748802', 45, footerY + 17, { align: 'center', width: pageW - 90, lineBreak: false });
            doc.font('Regular').fontSize(8).fillColor('#6B7280')
              .text('108 av. Pierre brossolette 92240 MALAKOFF FRANCE', 45, footerY + 29, { align: 'center', width: pageW - 90, lineBreak: false });
            doc.font('Regular').fontSize(8).fillColor('#6B7280')
              .text(`${i + 1}/${totalPages}`, pageW - 90, footerY + 17, { align: 'right', width: 45, lineBreak: false });
            console.log(`[FOOTER] page ${i + 1} done, doc.y after=${doc.y}`);
          }
          console.log(`[FOOTER] all ${totalPages} pages processed`);
          doc.on('end', async () => {
            try {
              const rawBuffer = Buffer.concat(chunks);
              if (response) {
                response.setHeader('Content-Length', rawBuffer.length);
                response.end(rawBuffer);
              }
              resolve(rawBuffer);
            } catch (e2) {
              reject(e2);
            }
          });
          doc.end();
        } catch (e) {
          reject(e);
        }
      })();
    });
  }

  async generateArticlePdfs(
    payload: GenerateArticlesPdfDto,
    response?: Response,
  ): Promise<Buffer> {
    const { articleIds } = payload;

    const logoPath = path.join(__dirname, '../images/ismo-logo-full.png');
    const iconPath = path.join(__dirname, '../images/info.png');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
      const chunks: Uint8Array[] = [];

      doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      doc.on('error', (err: Error) => reject(err));

      doc.registerFont('Regular', path.join(__dirname, '../assets/Roboto-Regular.ttf'));
      doc.registerFont('Bold', path.join(__dirname, '../assets/Roboto-Bold.ttf'));

      (async () => {
        try {
          for (const articleId of articleIds) {
            const centerX = (doc.page.width - 340) / 2;
            const logoHeight = 80;
            const logoY = 40;

            doc.image(logoPath, centerX, logoY, { width: 340, height: logoHeight });

            const contentStartY = logoY + logoHeight + 20;

            await this._addArticleContent(doc, articleId, logoPath, contentStartY);

            doc.addPage();
          }

          await this._addStaticLastPage(doc, logoPath, iconPath);

          await this._addFooter(doc, 0);

          // Add page numbers bottom-right on every page
          const range = doc.bufferedPageRange();
          const totalPages = range.count;
          for (let i = range.start; i < range.start + totalPages; i++) {
            doc.switchToPage(i);
            doc.x = doc.page.margins.left;
            doc.y = doc.page.margins.top;
            doc.page.margins.bottom = 0;
            doc
              .font('Regular')
              .fontSize(8)
              .fillColor('#6B7280')
              .text(
                `${i - range.start + 1}/${totalPages}`,
                doc.page.width - 60,
                doc.page.height - 20,
                { width: 45, align: 'right', lineBreak: false },
              );
          }

          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.end();
        } catch (err) {
          reject(err);
        }
      })();
    });
  }

  private async _addStaticLastPage(
    doc: PDFKit.PDFDocument,
    logoPath: string,
    infoPath: string,
  ) {
    const centerX = (doc.page.width - 340) / 2;

    doc.image(logoPath, centerX, 40, { width: 340, height: 80 });

    const logoBottomY = 40 + 80;
    const spaceAfterLogo = 30;
    const containerY = logoBottomY + spaceAfterLogo;
    const containerWidth = 500;
    const containerHeight = 180;
    const containerX = doc.page.margins.left + (doc.page.width - containerWidth) / 2;

    doc.roundedRect(containerX, containerY, containerWidth, containerHeight, 10).fill('#F5F5F5');

    const imageMargin = 10;
    const imageX = containerX + 5;
    const imageY = containerY + imageMargin;
    const imageWidth = 30;
    const imageHeight = 30;

    doc.image(infoPath, imageX, imageY, { width: imageWidth, height: imageHeight });

    const textTopSpacing = 5;
    const textWidth = 460;
    const textStartX = containerX + (containerWidth - textWidth) / 2;
    const textStartY = imageY + imageHeight + textTopSpacing;

    doc
      .font('Regular')
      .fillColor('#000')
      .fontSize(10)
      .text(
        'All information provided is believed to be accurate but ISMO SARL is not responsible for any errors, changes, or misrepresentation which may arise. ISMO provides no guarantee nor warranties with any used equipment purchases.',
        textStartX, textStartY,
        { width: textWidth, align: 'center' },
      )
      .moveDown(0.5)
      .text(
        'We recommend visiting the used equipment and inspect it before purchasing.',
        textStartX, doc.y,
        { width: textWidth, align: 'center' },
      );

    const spaceAfterEnglishText = 10;
    doc
      .font('Regular')
      .fillColor('#0A2D6E')
      .fontSize(10)
      .text(
        'Nous recommandons une visite technique avant chaque achat de matériel. Il n\u2019y a aucune garantie de matériel car le matériel est d\u2019occasion.',
        textStartX, doc.y + spaceAfterEnglishText,
        { width: textWidth, align: 'center' },
      );
  }

  private async _addArticleContent(
    doc: PDFKit.PDFDocument,
    articleId: number,
    logoPath: string,
    startY: number = 50,
  ) {
    const article = await this.db.article.findUnique({
      where: { id: articleId },
      include: {
        photos: { select: { name: true, description: true, url: true } },
      },
    });

    const containerPadding = 10;
    const containerWidth = doc.page.width - 100;
    const containerHeight = 60;

    doc.roundedRect(50, startY, containerWidth, containerHeight, 10).fill('#F4F4F4');

    const textStartY = startY + containerPadding;

    doc
      .font('Bold')
      .fillColor('#0A2D6E')
      .fontSize(18)
      .text(`${article.title}`, 60, textStartY, {
        align: 'center',
        width: containerWidth - 20,
      })
      .font('Regular')
      .fontSize(10)
      .fillColor('#495057')
      .text(`Référence : ${article.reference}`, 60, textStartY + 30, {
        align: 'center',
        width: containerWidth - 20,
      });

    let y = startY + containerHeight + 20;

    const plainDescription = htmlToText(article.description);
    doc
      .font('Regular')
      .fillColor('#030C1E')
      .fontSize(10)
      .text(plainDescription, 50, y, { width: containerWidth, align: 'justify' });

    y += doc.heightOfString(plainDescription, { width: containerWidth }) + 30;

    let hasTitle = false;
    let stillOnSamePage = true;

    for (const [index, photo] of article.photos.entries()) {
      const lastElement = index === article.photos.length - 1;
      const extension = path.extname(photo.url);

      if (extension !== '.pdf') {
        const imageBuffer = await this._fetchImageBuffer(photo.url);
        const plainText = htmlToText(photo.description);

        const range = doc.bufferedPageRange();

        hasTitle = Boolean(photo.name && photo.name.length > 0);
        stillOnSamePage = y > 300;

        if (y + 200 > doc.page.height - 100) {
          await this._addFooter(doc, range.start);
          stillOnSamePage = false;
          doc.addPage();
          y = 50;
        }

        if (!hasTitle && stillOnSamePage) {
          await this._addFooter(doc, range.start);
          doc.addPage();
          y = 50;
        }

        const photoContainerHeight = 170 * (!hasTitle ? 2 : 1);

        if (hasTitle) {
          doc
            .save()
            .roundedRect(50, y, containerWidth / 2, photoContainerHeight, 10)
            .clip()
            .image(imageBuffer, 50, y, {
              width: containerWidth / 2,
              height: photoContainerHeight,
            })
            .restore();
          this._drawImageWatermarkOverlay(doc, 50, y, containerWidth / 2, photoContainerHeight);

          const textX = 50 + containerWidth / 2 + 20;
          const textWidth = containerWidth / 2 - 30;

          doc.font('Bold').fontSize(12).fillColor('#000').text(photo.name, textX, y, { width: textWidth });

          const lineY = y + doc.heightOfString(photo.name, { width: textWidth }) + 10;
          doc.moveTo(textX, lineY).lineTo(textX + textWidth, lineY).strokeColor('#000').lineWidth(1).stroke();

          doc.font('Regular').fontSize(10).fillColor('#1F1F1F').text(plainText, textX, lineY + 10, {
            width: textWidth,
            align: 'justify',
          });
        } else {
          doc
            .save()
            .roundedRect(50, y, containerWidth, photoContainerHeight, 10)
            .clip()
            .image(imageBuffer, 50, y, {
              width: containerWidth,
              height: photoContainerHeight,
            })
            .restore();
          this._drawImageWatermarkOverlay(doc, 50, y, containerWidth, photoContainerHeight);

          const r = doc.bufferedPageRange();
          await this._addFooter(doc, r.start);
          if (!lastElement) doc.addPage();
        }

        if (hasTitle) y += photoContainerHeight + 30;
        else y = 50;
      }
    }

    const range = doc.bufferedPageRange();
    await this._addFooter(doc, range.start);
  }

  private async _addFooter(doc: PDFKit.PDFDocument, page: number) {
    doc.font('Regular').fontSize(8).fillColor('#1F1F1F');

    const footerStartY = doc.page.height - 130;
    const iconSize = 10;
    const lineSpacing = 20;
    const columnWidth = 150;
    const columnGap = 40;

    const totalFooterWidth = columnWidth * 2 + columnGap;
    const startX = (doc.page.width - totalFooterWidth) / 2;

    const leftColumnX = startX;
    const rightColumnX = startX + columnWidth + columnGap;

    const webIconPath = path.join(__dirname, '../images/website.png');
    const mobileIconPath = path.join(__dirname, '../images/mobile.png');
    const tvaIconPath = path.join(__dirname, '../images/tva.png');
    const locationIconPath = path.join(__dirname, '../images/location-pin.png');
    const telephoneIconPath = path.join(__dirname, '../images/telephone.png');
    const siretIconPath = path.join(__dirname, '../images/siret.png');
    const companyIconPath = path.join(__dirname, '../images/company.png');

    let currentY = footerStartY;
    doc.image(webIconPath, leftColumnX, currentY, { width: iconSize, height: iconSize });
    doc.text('www.ismomat.fr', leftColumnX + iconSize + 5, currentY, { align: 'left', width: columnWidth - (iconSize + 5) });

    currentY += lineSpacing;
    doc.image(mobileIconPath, leftColumnX, currentY, { width: iconSize, height: iconSize });
    doc.text('MOBIL 33 (0) 6 74 30 85 55', leftColumnX + iconSize + 5, currentY, { align: 'left', width: columnWidth - (iconSize + 5) });

    currentY += lineSpacing;
    doc.image(tvaIconPath, leftColumnX, currentY, { width: iconSize, height: iconSize });
    doc.text('TVA FR28392748802 - APE 516 K', leftColumnX + iconSize + 5, currentY, { align: 'left', width: columnWidth - (iconSize + 5) });

    let currentYRight = footerStartY;
    doc.image(telephoneIconPath, rightColumnX, currentYRight, { width: iconSize, height: iconSize });
    doc.text('TEL 33 (0)1 42 53 53 60', rightColumnX + iconSize + 5, currentYRight, { align: 'left', width: columnWidth - (iconSize + 5) });

    currentYRight += lineSpacing;
    doc.image(siretIconPath, rightColumnX, currentYRight, { width: iconSize, height: iconSize });
    doc.text('SIRET 392 748 802 00023', rightColumnX + iconSize + 5, currentYRight, { align: 'left', width: columnWidth - (iconSize + 5) });

    currentYRight += lineSpacing;
    doc.image(companyIconPath, rightColumnX, currentYRight, { width: iconSize, height: iconSize });
    doc.text('S.A.R.L au Capital de 7622.45 \u20ac', rightColumnX + iconSize + 5, currentYRight, { align: 'left', width: columnWidth - (iconSize + 5) });

    const lastLineY = Math.max(currentY, currentYRight) + lineSpacing;
    doc.image(locationIconPath, leftColumnX + iconSize + 10, lastLineY, { width: iconSize, height: iconSize });
    doc.text('ISMO SARL 108 avenue Pierre Brossolette 92240 MALAKOFF France', leftColumnX - 15, lastLineY, { align: 'center', width: 350 });

    const pageNumberY = doc.page.height - 25;
    doc
      .moveTo(doc.page.width / 2 - 250, pageNumberY - 5)
      .lineTo(doc.page.width / 2 - 30, pageNumberY - 5)
      .strokeColor('#1F1F1F')
      .lineWidth(0.5)
      .stroke();

    doc
      .moveTo(doc.page.width / 2 + 30, pageNumberY - 5)
      .lineTo(doc.page.width / 2 + 250, pageNumberY - 5)
      .strokeColor('#1F1F1F')
      .lineWidth(0.5)
      .stroke();

    doc
      .fontSize(8)
      .fillColor('#1F1F1F')
      .text(`Page ${page + 1}`, doc.page.width / 2 - 20, pageNumberY - 10, { align: 'center', width: 40 });
  }

  async remove(id: number) {
    const article = await this.db.article.findUnique({
      where: { id },
      select: { reference: true, title: true },
    });

    const deleted = await this.db.article.delete({ where: { id } });

    // Remove from WordPress
    if (article) {
      this.removeArticleFromWordPress(
        article.reference || `PROD-${id}`,
        article.title,
      ).catch((err) => console.error('Background WordPress delete failed:', err));
    }

    return deleted;
  }
}
