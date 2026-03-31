import { Global, Module } from '@nestjs/common';

import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { DatabaseModule } from 'src/database/database.module';
import { ZohoModule } from 'src/zoho/zoho.module';

@Global()
@Module({
  controllers: [MailController],
  providers: [MailService],
  imports: [DatabaseModule, ZohoModule],
  exports: [MailService],
})
export class MailModule {}
