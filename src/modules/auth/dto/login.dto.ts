import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Exclude, Transform } from 'class-transformer';

export class LoginDto {
  @IsEmail({}, { message: 'Введите корректный email' })
  @IsNotEmpty({ message: 'Введите почту' })
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  /** Пароль — только для проверки по хэшу. Стандарт: 8–128 символов. */
  @Exclude()
  @IsString()
  @IsNotEmpty({ message: 'Введите пароль' })
  @MinLength(8, { message: 'Пароль не короче 8 символов' })
  @MaxLength(128, { message: 'Пароль не длиннее 128 символов' })
  password!: string;
}
