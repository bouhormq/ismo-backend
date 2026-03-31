import { Module } from '@nestjs/common';

import { AxonautService } from './axonaut.service';
import { AxonautConfig } from './config/axonaut.config';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [AxonautService, AxonautConfig],
  exports: [AxonautService],
})
export class AxonautModule {}
