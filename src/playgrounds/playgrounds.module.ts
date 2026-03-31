import { Module } from '@nestjs/common';
import { PlaygroundsService } from './playgrounds.service';
import { PlaygroundsController } from './playgrounds.controller';
import { DatabaseModule } from '@faker-js/faker/.';
import { CompaniesModule } from 'src/companies/companies.module';
import { MailModule } from 'src/integrations/mail/mail.module';

@Module({
  controllers: [PlaygroundsController],
  imports: [MailModule],
  providers: [PlaygroundsService],
})
export class PlaygroundsModule {}
