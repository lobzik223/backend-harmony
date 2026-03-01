import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyEmailDto {
  @IsEmail({}, { message: 'Введите корректный email' })
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Введите код' })
  @Length(6, 6, { message: 'Код состоит из 6 цифр' })
  @Matches(/^\d{6}$/, { message: 'Код — только 6 цифр' })
  code!: string;
}
