import { IsString, IsIn, IsInt, Min, IsOptional } from 'class-validator';

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsIn(['MEDITATION', 'SLEEP', 'HOME'])
  type?: string;

  @IsOptional()
  @IsIn(['STATIC', 'TRACKS', 'VIDEO'])
  cardType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
