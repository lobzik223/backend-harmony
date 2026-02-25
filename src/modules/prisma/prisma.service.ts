import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  onModuleInit() {
    return this.$connect().then(() => this.logger.log('Prisma connected to PostgreSQL'));
  }

  onModuleDestroy() {
    return this.$disconnect().then(() => this.logger.log('Prisma disconnected'));
  }
}
