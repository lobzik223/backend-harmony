import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthStatsDto {
  serverOk: boolean;
  dbOk: boolean;
  registrationsToday: number;
  registrationsWeek: number;
  registrationsMonth: number;
  deletedAccounts: number;
}

@Injectable()
export class HealthStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<HealthStatsDto> {
    let dbOk = false;
    let registrationsToday = 0;
    let registrationsWeek = 0;
    let registrationsMonth = 0;
    let deletedAccounts = 0;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      return {
        serverOk: true,
        dbOk: false,
        registrationsToday: 0,
        registrationsWeek: 0,
        registrationsMonth: 0,
        deletedAccounts: 0,
      };
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, week, month, deleted] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gte: startOfDay }, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfWeek }, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfMonth }, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { deletedAt: { not: null } },
      }),
    ]);

    registrationsToday = today;
    registrationsWeek = week;
    registrationsMonth = month;
    deletedAccounts = deleted;

    return {
      serverOk: true,
      dbOk,
      registrationsToday,
      registrationsWeek,
      registrationsMonth,
      deletedAccounts,
    };
  }
}
