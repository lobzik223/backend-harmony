import { Controller, Get, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { HealthStatsService } from './health-stats.service';
import { env } from '../../config/env.validation';

@Controller('health')
export class HealthController {
  constructor(
    private readonly maintenance: MaintenanceService,
    private readonly healthStats: HealthStatsService,
  ) {}

  @Get()
  async health() {
    const maintenance = await this.maintenance.isEnabled();
    return {
      status: 'ok',
      message: 'Harmony backend is healthy',
      maintenance,
    };
  }

  /** Статистика для панели: сервер, БД, регистрации за день/неделю/месяц, удалённые аккаунты. Защита: заголовок X-Harmony-App-Key. */
  @Get('stats')
  async stats(@Headers('x-harmony-app-key') appKey: string) {
    if (env.APP_KEY && appKey !== env.APP_KEY) {
      throw new UnauthorizedException('Unauthorized');
    }
    return this.healthStats.getStats();
  }

  @Get('config')
  getAppConfig() {
    return {
      supportTelegramUrl: env.SUPPORT_TELEGRAM_URL,
    };
  }

  @Post('maintenance')
  async setMaintenance(@Body() body: { enabled: boolean }) {
    await this.maintenance.setEnabled(!!body.enabled);
    const maintenance = await this.maintenance.isEnabled();
    return { maintenance };
  }
}
