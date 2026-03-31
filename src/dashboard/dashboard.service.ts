import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { countOccurrences } from './utils/misc.function';
import { MailService } from 'src/integrations/mail/mail.service';
import { ZohoService } from 'src/zoho/zoho.service';
import { formatDateUtils } from 'src/utils/constants/misc.constants';

@Injectable()
export class DashboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mailService: MailService,
    private readonly zohoService: ZohoService,
  ) {}

  async getDashboardData(query: { startDate?: string; endDate?: string }) {
    const { startDate, endDate } = query;

    const startDateStartOfDay = startDate ? new Date(startDate) : undefined;
    if (startDateStartOfDay) startDateStartOfDay.setUTCHours(0, 0, 0, 0);

    const endDateEndofDay = endDate ? new Date(endDate) : undefined;
    if (endDateEndofDay) endDateEndofDay.setUTCHours(23, 59, 59, 999);

    const formattedStartDate = startDateStartOfDay
      ? formatDateUtils.getStartOfDay(startDateStartOfDay)
      : undefined;
    const formattedEndDate = endDateEndofDay
      ? formatDateUtils.getEndOfDay(endDateEndofDay)
      : undefined;
    const [companiesRaw, articlesRaw, emailEvents] = await Promise.allSettled([
      this.db.company.findMany({
        where: {
          createdAt: {
            ...(startDateStartOfDay && { gte: startDateStartOfDay }),
            ...(endDateEndofDay && { lte: endDateEndofDay }),
          },
        },
        include: {
          categories: { select: { name: true } },
          industries: { select: { name: true } },
          sections: { select: { name: true } },
        },
      }),
      this.db.article.findMany({
        where: {
          createdAt: {
            ...(startDateStartOfDay && { gte: startDateStartOfDay }),
            ...(endDateEndofDay && { lte: endDateEndofDay }),
          },
        },
        include: {
          category: { select: { name: true } },
          industry: { select: { name: true } },
          section: { select: { name: true } },
        },
      }),
      this.mailService.getEmailEventReport({
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      }),
    ]);

    const companies =
      companiesRaw.status === 'fulfilled' ? companiesRaw.value : [];
    const articles =
      articlesRaw.status === 'fulfilled' ? articlesRaw.value : [];

    const allEmails =
      emailEvents.status === 'fulfilled' ? emailEvents.value : [];

    const companyIndustries = companies.map((company) => company.industries);
    const companyCategories = companies.map((company) => company.categories);
    const companySections = companies.map((company) => company.sections);

    const companyIndustryCounts = countOccurrences(companyIndustries);
    const companyCategoryCounts = countOccurrences(companyCategories);
    const companySectionCounts = countOccurrences(companySections);

    const articleIndustries = articles.map((article) => article.industry);
    const articleCategories = articles.map((article) => article.category);
    const articleSections = articles.map((article) => article.section);

    const articleIndustryCounts = countOccurrences(articleIndustries);
    const articleCategoryCounts = countOccurrences(articleCategories);
    const articleSectionCounts = countOccurrences(articleSections);

    const formatResult = (counts: Record<string, number>) =>
      Object.entries(counts).map(([name, count]) => ({ name, count }));

    const companyIndustryResult = formatResult(companyIndustryCounts);
    const companyCategoryResult = formatResult(companyCategoryCounts);
    const companySectionResult = formatResult(companySectionCounts);

    const articleIndustryResult = formatResult(articleIndustryCounts);
    const articleCategoryResult = formatResult(articleCategoryCounts);
    const articleSectionResult = formatResult(articleSectionCounts);

    const allCompanies = await this.db.company.findMany({
      where: {
        createdAt: {
          ...(startDateStartOfDay && { gte: startDateStartOfDay }),
          ...(endDateEndofDay && { lte: endDateEndofDay }),
        },
      },
      select: {
        createdAt: true,
        country: true,
      },
    });

    const zohoStats = await this.zohoService.getDashboardStats().catch(() => ({
      totalRevenue: 0,
      emailsCount: 0,
    }));

    const totalEmailsCount = (allEmails?.length ?? 0) + zohoStats.emailsCount;

    return {
      allCompanies,
      allEmails: totalEmailsCount,
      chiffreAffaires: zohoStats.totalRevenue,
      companies: {
        industries: companyIndustryResult,
        categories: companyCategoryResult,
        sections: companySectionResult,
      },
      articles: {
        industries: articleIndustryResult,
        categories: articleCategoryResult,
        sections: articleSectionResult,
      },
    };
  }
}
