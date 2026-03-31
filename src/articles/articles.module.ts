import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { MediaModule } from 'src/media/media.module';

@Module({
  imports: [MediaModule],
  exports: [ArticlesService],
  controllers: [ArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
