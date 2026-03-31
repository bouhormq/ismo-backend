import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { MediaModule } from 'src/media/media.module';
import { ZohoModule } from 'src/zoho/zoho.module';
import { ArticlesModule } from 'src/articles/articles.module';

@Module({
  imports: [MediaModule, ZohoModule, ArticlesModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
