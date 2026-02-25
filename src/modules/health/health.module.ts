import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthStatsService } from './health-stats.service';
import { MaintenanceService } from './maintenance.service';

@Module({
  controllers: [HealthController],
  providers: [MaintenanceService, HealthStatsService],
})
export class HealthModule {}
