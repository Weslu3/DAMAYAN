import { IsNotEmpty, IsOptional, IsString, Min, IsInt } from 'class-validator';

export class CreateDisasterCoverUploadDto {
  @IsNotEmpty()
  @IsString()
  disasterEventId!: string;

  @IsNotEmpty()
  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  expiresIn?: number;
}
