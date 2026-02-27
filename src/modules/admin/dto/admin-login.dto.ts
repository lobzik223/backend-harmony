import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @IsEmail({}, { message: 'Введите корректный email' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Пароль не менее 8 символов' })
  password!: string;
}
