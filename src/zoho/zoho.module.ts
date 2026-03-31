import { Module } from '@nestjs/common';

import { ZohoService } from './zoho.service';
import { ZohoConfig } from './config/zoho.config';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ZohoService, ZohoConfig],
  exports: [ZohoService],
})
export class ZohoModule {}
