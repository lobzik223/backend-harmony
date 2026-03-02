import { IsString, IsIn, IsInt, Min, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateArticleDto {
  @IsIn(['FEATURED', 'RECOMMENDED', 'EMERGENCY'])
  blockType!: string;

  @IsString()
  @MinLength(1, { message: 'Название не может быть пустым' })
  @MaxLength(200, { message: 'Название не более 200 символов' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Краткое описание не более 500 символов' })
  descriptionShort?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000, { message: 'Полное описание не более 10000 символов' })
  descriptionFull?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  publishedAt?: string; // ISO date

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;
}
