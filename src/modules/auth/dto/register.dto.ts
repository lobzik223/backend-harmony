import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Exclude, Transform } from 'class-transformer';

export class RegisterDto {
  /** Имя — обязательно к заполнению */
  @IsString()
  @IsNotEmpty({ message: 'Введите имя' })
  @MinLength(1, { message: 'Введите имя' })
  @MaxLength(50, { message: 'Имя не длиннее 50 символов' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  /** Фамилия — обязательно к заполнению */
  @IsString()
  @IsNotEmpty({ message: 'Введите фамилию' })
  @MinLength(1, { message: 'Введите фамилию' })
  @MaxLength(50, { message: 'Фамилия не длиннее 50 символов' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  surname!: string;

  /** Почта — обязательно */
  @IsEmail({}, { message: 'Введите корректный email' })
  @IsNotEmpty({ message: 'Введите почту' })
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  /** Пароль — только для хэширования. Стандарт: 8–128 символов. */
  @Exclude()
  @IsString()
  @IsNotEmpty({ message: 'Введите пароль' })
  @MinLength(8, { message: 'Пароль не короче 8 символов' })
  @MaxLength(128, { message: 'Пароль не длиннее 128 символов' })
  password!: string;
}
