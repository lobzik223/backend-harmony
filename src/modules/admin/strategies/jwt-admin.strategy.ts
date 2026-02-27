import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../../../config/env.validation';
import type { AdminJwtPayload } from '../admin.service';

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.ADMIN_JWT_SECRET,
    });
  }

  validate(payload: AdminJwtPayload) {
    if (payload?.typ !== 'admin') return null;
    return payload;
  }
}
