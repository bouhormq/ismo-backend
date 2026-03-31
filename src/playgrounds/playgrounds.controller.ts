import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PlaygroundsService } from './playgrounds.service';
import { CompaniesService } from 'src/companies/companies.service';
import { GetAllCompaniesDto } from 'src/companies/dto/get-all-companies.dto';
import { MailService } from 'src/integrations/mail/mail.service';
import { Public } from 'src/auth/decorators';

@Controller('playground')
export class PlaygroundsController {
  constructor(private readonly mailService: MailService) {
    console.log('BREVO_KEY_PREFIX:', process.env.BREVO_API_KEY?.substring(0, 10));
  }

  @Get('logs')
  async getLogs() {
    return await this.mailService.getTransactionEmailLogs({
      email: '',
      limit: '10',
      offset: '0',
    });
  }

  @Public()
  @Post('test-signature')
  async testSignature(@Body() body: { userName: string }) {
    const user = {
      name: body.userName,
      signatureImageUrl: null,
    };

    const signatureHtml = this.mailService.generateSignatureHtml(user);

    await this.mailService.send({
      sender: { email: 'info@ismomat.fr', name: user.name },
      to: [{ email: 'bouhormq@gmail.com', name: 'Test' }],
      subject: `Test Signature - ${user.name}`,
      templateId: 1,
      params: {
        companyName: 'Test',
        message: `<p>Ceci est un test de signature pour <strong>${user.name}</strong>.</p>`,
        signature: signatureHtml,
        documents: [],
      },
    });

    return { success: true, userName: body.userName };
  }
}
