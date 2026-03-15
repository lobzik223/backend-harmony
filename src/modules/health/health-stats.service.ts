import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

export interface DiskUsageItem {
  path: string;
  label: string;
  bytes: number;
}

export interface HealthStatsDto {
  serverOk: boolean;
  dbOk: boolean;
  totalActiveUsers: number;
  registrationsToday: number;
  registrationsWeek: number;
  registrationsMonth: number;
  deletedAccounts: number;
  diskUsage?: {
    folders: DiskUsageItem[];
    totalUploadsBytes: number;
    diskTotalBytes?: number;
    diskUsedBytes?: number;
    diskAvailBytes?: number;
  };
}

@Injectable()
export class HealthStatsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getDirSizeBytes(dirPath: string): Promise<number> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      let total = 0;
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        const s = await stat(fullPath);
        if (s.isDirectory()) {
          total += await this.getDirSizeBytes(fullPath);
        } else {
          total += s.size;
        }
      }
      return total;
    } catch {
      return 0;
    }
  }

  private async getDiskUsageAsync(): Promise<HealthStatsDto['diskUsage']> {
    try {
      const cwd = process.cwd();
      const uploadsDir = join(cwd, 'uploads');
      const folders: { path: string; label: string }[] = [
        { path: join(uploadsDir, 'covers'), label: 'Обложки' },
        { path: join(uploadsDir, 'tracks'), label: 'Треки' },
        { path: join(uploadsDir, 'articles'), label: 'Статьи' },
        { path: join(uploadsDir, 'course-tracks'), label: 'Треки курсов' },
      ];
      const items: DiskUsageItem[] = [];
      let totalUploadsBytes = 0;
      for (const f of folders) {
        const bytes = await this.getDirSizeBytes(f.path);
        items.push({ path: f.path, label: f.label, bytes });
        totalUploadsBytes += bytes;
      }
      let diskTotalBytes: number | undefined;
      let diskUsedBytes: number | undefined;
      let diskAvailBytes: number | undefined;
      try {
        const df = execSync('df -B1 / 2>/dev/null | tail -1', { encoding: 'utf8' });
        const parts = df.trim().split(/\s+/);
        if (parts.length >= 4) {
          diskTotalBytes = Number.parseInt(parts[1], 10);
          diskUsedBytes = Number.parseInt(parts[2], 10);
          diskAvailBytes = Number.parseInt(parts[3], 10);
        }
      } catch {
        // df not available or failed
      }
      return {
        folders: items,
        totalUploadsBytes,
        diskTotalBytes,
        diskUsedBytes,
        diskAvailBytes,
      };
    } catch {
      return undefined;
    }
  }

  async getStats(): Promise<HealthStatsDto> {
    let dbOk = false;
    let totalActiveUsers = 0;
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
        totalActiveUsers: 0,
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

    const [total, today, week, month, deleted] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
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

    totalActiveUsers = total;
    registrationsToday = today;
    registrationsWeek = week;
    registrationsMonth = month;
    deletedAccounts = deleted;

    let diskUsage: HealthStatsDto['diskUsage'];
    try {
      diskUsage = await this.getDiskUsageAsync();
    } catch {
      diskUsage = undefined;
    }

    return {
      serverOk: true,
      dbOk,
      totalActiveUsers,
      registrationsToday,
      registrationsWeek,
      registrationsMonth,
      deletedAccounts,
      diskUsage,
    };
  }
}
