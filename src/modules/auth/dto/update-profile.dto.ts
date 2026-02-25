import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Имя не может быть пустым' })
  @MaxLength(50, { message: 'Имя не длиннее 50 символов' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Фамилия не может быть пустой' })
  @MaxLength(50, { message: 'Фамилия не длиннее 50 символов' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  surname?: string;
}
