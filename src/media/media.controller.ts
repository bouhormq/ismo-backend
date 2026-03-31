import { Body, Controller, Param, Post } from '@nestjs/common';
import { MediaService } from './media.service';
import { GetUploadPathDto } from './dto/get-upload-path.dto';

@Controller('media')
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Post('get-upload-path/:fileName')
  async getUploadPath(
    @Param('fileName') fileName: string,
    @Body() { path, isPublic }: GetUploadPathDto,
  ) {
    return this.mediaService.getUploadPath(fileName, path, isPublic);
  }
}
