import { IsString, IsIn, IsInt, Min, IsOptional } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsIn(['MEDITATION', 'SLEEP', 'HOME'])
  type!: string;

  @IsOptional()
  @IsIn(['STATIC', 'TRACKS', 'VIDEO'])
  cardType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
