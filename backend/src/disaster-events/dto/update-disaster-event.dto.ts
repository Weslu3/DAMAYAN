import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateDisasterEventDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  severityLevel?: string;

  @IsOptional()
  @Type(() => String)
  @IsArray()
  affectedAreas?: string[];

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsDateString()
  dateStarted?: string;

  @IsOptional()
  @IsDateString()
  dateEnded?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  declaredBy?: string;

  @IsOptional()
  @IsString()
  coverImageKey?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
