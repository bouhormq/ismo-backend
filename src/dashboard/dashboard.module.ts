import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ZohoModule } from 'src/zoho/zoho.module';

@Module({
  imports: [ZohoModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
