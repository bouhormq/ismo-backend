import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboardData(
    @Query() query: { startDate?: string; endDate?: string },
  ) {
    return this.dashboardService.getDashboardData(query);
  }
}
