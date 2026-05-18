import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDisasterEventDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsString()
  type!: string;

  @IsNotEmpty()
  @IsString()
  severityLevel!: string;

  @Type(() => String)
  @IsArray()
  affectedAreas!: string[];

  @IsNotEmpty()
  @IsString()
  province!: string;

  @IsDateString()
  dateStarted!: string;

  @IsOptional()
  @IsDateString()
  dateEnded?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsNotEmpty()
  @IsString()
  declaredBy!: string;

  @IsOptional()
  @IsString()
  coverImageKey?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
