import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdatePushTokenDto {
  @IsString()
  deviceId!: string;

  @IsString()
  @IsOptional()
  pushToken?: string | null;

  @IsOptional()
  @IsIn(['ios', 'android', 'web'])
  platform?: string;

  @IsOptional()
  @IsIn(['ru', 'en'])
  preferredLocale?: 'ru' | 'en';
}
