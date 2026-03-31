import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { GenerateCompaniesExcelDto } from './dto/generate-excel.dto';
import { GetAllCompaniesReportDto } from './dto/get-all-companies-report.dto';
import { GetAllCompaniesDto } from './dto/get-all-companies.dto';
import { SendEmailsDto } from './dto/send-emails.dto';
import { SendEmailingDto } from './dto/send-emailing.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { GetAllCompaniesReportExcelDto } from './dto/get-all-companies-report-excel.dto';
import { Response } from 'express';
import { GenerateCompaniesPdfDto } from './dto/generate-pdf.dto';
import { GetCitiesSchema } from './dto/get-cities.dto';
import { User } from '@prisma/client';
import { AuthUser } from 'src/auth/decorators';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @Post('send-emails')
  sendEmails(@Body() payload: SendEmailsDto, @AuthUser() user: User) {
    return this.companiesService.sendEmails(payload, user);
  }

  @Post('send-emailing')
  sendEmailing(@Body() payload: SendEmailingDto, @AuthUser() user: User) {
    return this.companiesService.sendEmailing(payload, user);
  }

  @Get()
  findAll(@Query() payload: GetAllCompaniesDto) {
    return this.companiesService.findAll(payload);
  }

  @Get('city-options')
  getCityOptions(@Query() { city, country }: GetCitiesSchema) {
    if (!country) {
      return [];
    }

    return this.companiesService.getCityOptions(country, city);
  }

  @Get('report')
  getAllCompaniesReport(@Query() payload: GetAllCompaniesReportDto) {
    return this.companiesService.getAllCompaniesReport(payload);
  }

  @Post('report/generate-excel')
  generateCompanyReportExcelData(
    @Body() payload: GetAllCompaniesReportExcelDto,
  ) {
    return this.companiesService.generateCompanyReportExcelData(payload);
  }

  @Get('actions-report')
  getAllCompaniesActionsReport(@Query() payload: GetAllCompaniesReportDto) {
    return this.companiesService.getAllCompaniesActionsReport(payload);
  }

  @Get('offers')
  getCompanyOffers(@Query() payload: { companyId: string }) {
    return this.companiesService.getCompanyOffers(payload.companyId);
  }

  @Post('actions-report/generate-excel')
  generateCompanyActionsExcelData(
    @Body() payload: GetAllCompaniesReportExcelDto,
  ) {
    return this.companiesService.generateCompanyActionsExcelData(payload);
  }

  @Post('report/generate-pdf')
  async generateCompanyReportPdf(
    @Res() res: Response,
    @Body() payload: GetAllCompaniesReportExcelDto,
  ): Promise<void> {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="recapitulatif-societes.pdf"',
    );
    await this.companiesService.generateCompaniesReportPDF(payload, res);
  }

  @Post('actions-report/generate-pdf')
  async generateActionsReportPdf(
    @Res() res: Response,
    @Body() payload: GetAllCompaniesReportExcelDto,
  ): Promise<void> {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="recapitulatif-actions.pdf"',
    );
    await this.companiesService.generateActionsReportPDF(payload, res);
  }

  @Get('options')
  findAllCompanyOptions() {
    return this.companiesService.findAllCompanyOptions();
  }

  @Get('filter-options')
  async getFilterOptions() {
    return this.companiesService.getFilterOptions();
  }

  @Post('generate-excel')
  async generateExcelData(@Body() payload: GenerateCompaniesExcelDto) {
    return this.companiesService.generateExcelData(payload);
  }

  @Post('generate-pdf')
  async generatePdf(
    @Res() res: Response,
    @Body() payload: GenerateCompaniesPdfDto,
  ): Promise<void> {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="articles.pdf"');

    await this.companiesService.generateCompaniesPDF(payload, res);
  }

  @Post(':id/sync-zoho')
  syncZohoContact(@Param('id') id: string) {
    return this.companiesService.syncZohoContact(+id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(+id, updateCompanyDto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.companiesService.removeCategory(+id);
  }

  @Delete('sections/:id')
  removeSection(@Param('id') id: string) {
    return this.companiesService.removeSection(+id);
  }

  @Delete('industries/:id')
  removeIndustry(@Param('id') id: string) {
    return this.companiesService.removeIndustry(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companiesService.remove(+id);
  }
}
