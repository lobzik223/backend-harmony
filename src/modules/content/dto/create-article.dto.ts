import { IsString, IsIn, IsInt, Min, IsOptional } from 'class-validator';

export class CreateArticleDto {
  @IsIn(['FEATURED', 'RECOMMENDED', 'EMERGENCY'])
  blockType: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  descriptionShort?: string;

  @IsOptional()
  @IsString()
  descriptionFull?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
