import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { S3Config } from 'src/utils/constants/config.constants';

@Module({
  controllers: [MediaController],
  providers: [MediaService, S3Config],
  exports: [MediaService],
})
export class MediaModule {}
