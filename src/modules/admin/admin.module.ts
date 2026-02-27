import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../../config/env.validation';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { JwtAdminStrategy } from './strategies/jwt-admin.strategy';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: env.ADMIN_JWT_TTL_SECONDS },
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService, JwtAdminStrategy, AdminJwtGuard],
  exports: [AdminService, AdminJwtGuard],
})
export class AdminModule {}
