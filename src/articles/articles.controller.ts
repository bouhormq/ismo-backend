import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { GetAllArticlesDto } from './dto/get-all-articles.dto';
import { GenerateArticlesExcelDto } from './dto/genearte-excel.dto';
import { GetAllCompanyArticlesDto } from './dto/get-all-company-articles.dto';
import { GenerateArticlesPdfDto } from './dto/generate-pdf.dto';
import { Response } from 'express';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  create(@Body() createArticleDto: CreateArticleDto) {
    return this.articlesService.create(createArticleDto);
  }

  @Get()
  findAll(@Query() payload: GetAllArticlesDto) {
    return this.articlesService.findAll(payload);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateArticleDto: UpdateArticleDto) {
    return this.articlesService.update(+id, updateArticleDto);
  }

  @Post('showcase-articles')
  synchronizeShowcaseArticles(@Body() payload: { selectedIds: number[] }) {
    return this.articlesService.synchronizeShowcaseArticles(payload);
  }

  @Get('company-articles')
  findAllCompanyArticles(@Query() payload: GetAllCompanyArticlesDto) {
    return this.articlesService.getAllCompanyArticles(payload);
  }

  @Post('generate-excel')
  async generateExcelData(@Body() payload: GenerateArticlesExcelDto) {
    return this.articlesService.generateExcelData(payload);
  }

  @Post('generate-pdf')
  async generatePdf(
    @Res() res: Response,
    @Body() payload: GenerateArticlesPdfDto,
  ): Promise<void> {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="articles.pdf"');

    const buffer = await this.articlesService.generateArticlePdfs(payload);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Post('generate-catalogue-pdf')
  async generateCataloguePdf(
    @Res() res: Response,
    @Body() payload: GenerateArticlesPdfDto,
  ): Promise<void> {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="catalogue.pdf"');

    await this.articlesService.generateCataloguePdf(payload, res);
  }

  @Get('filter-options')
  async getFilterOptions() {
    return this.articlesService.getFilterOptions();
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.articlesService.removeCategory(+id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(+id);
  }
}
