import { IsString, IsBoolean, IsInt, Min, IsOptional, IsIn } from 'class-validator';

export class CreateTrackDto {
  @IsString()
  sectionId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  descriptionShort?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsIn(['AUDIO', 'VIDEO'])
  mediaType?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}
