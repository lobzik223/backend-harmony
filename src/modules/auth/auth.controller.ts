import { Body, Controller, Delete, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AppleLoginDto } from './dto/apple-login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import type { JwtAccessPayload, JwtRefreshPayload } from './types/jwt-payload';

/** Пароли только хэшируются/проверяются по хэшу; в ответах и БД — только хэш. Не логировать body запросов register/login. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register({
      name: dto.name,
      surname: dto.surname,
      email: dto.email,
      password: dto.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login({
      ...dto,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('google')
  @Throttle({ default: { limit: 10, ttl: 60 } })
  loginWithGoogle(@Body() dto: GoogleLoginDto, @Req() req: Request) {
    return this.auth.loginWithGoogle({
      idToken: dto.idToken,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('apple')
  @Throttle({ default: { limit: 10, ttl: 60 } })
  loginWithApple(@Body() dto: AppleLoginDto, @Req() req: Request) {
    return this.auth.loginWithApple({
      identityToken: dto.identityToken,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  @SkipThrottle()
  me(@Req() req: Request & { user: JwtAccessPayload }) {
    return this.auth.me(req.user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAccessGuard)
  updateProfile(
    @Req() req: Request & { user: JwtAccessPayload },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(req.user.sub, dto);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @SkipThrottle()
  refresh(@Body() _dto: RefreshDto, @Req() req: Request & { user: JwtRefreshPayload }) {
    return this.auth.refresh(req.user.sub, req.user.jti, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('logout')
  @UseGuards(JwtRefreshGuard)
  @SkipThrottle()
  logout(@Body() _dto: RefreshDto, @Req() req: Request & { user: JwtRefreshPayload }) {
    return this.auth.logout(req.user.sub, req.user.jti);
  }

  /** Удаление аккаунта пользователем (в приложении). */
  @Delete('me')
  @UseGuards(JwtAccessGuard)
  @SkipThrottle()
  deleteAccount(@Req() req: Request & { user: JwtAccessPayload }) {
    return this.auth.deleteAccount(req.user.sub);
  }
}
