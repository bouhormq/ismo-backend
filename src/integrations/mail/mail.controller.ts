import { Controller, Get, Query } from '@nestjs/common';
import { MailService } from './mail.service';
import { PaginationOptions } from 'src/types/util.types';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('logs')
  async getLogs(@Query() query: { companyId: string } & PaginationOptions) {
    return await this.mailService.getTransactionEmailLogsWrapper(query);
  }
}
