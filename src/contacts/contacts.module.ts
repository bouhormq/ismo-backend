import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { MediaModule } from 'src/media/media.module';
import { ArticlesModule } from 'src/articles/articles.module';
import { ZohoModule } from 'src/zoho/zoho.module';

@Module({
  imports: [MediaModule, ArticlesModule, ZohoModule],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
