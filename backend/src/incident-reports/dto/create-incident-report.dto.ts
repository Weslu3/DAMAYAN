import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateIncidentReportDto {
  @IsNotEmpty()
  @IsString()
  disasterId!: string;

  @IsNotEmpty()
  @IsString()
  reportedBy!: string;

  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  content!: string;

  @IsNotEmpty()
  @IsString()
  severity!: string;

  @IsNotEmpty()
  @IsString()
  location!: string;

  @IsOptional()
  @Type(() => String)
  @IsArray()
  attachmentKeys?: string[];

  @IsOptional()
  @IsString()
  status?: string;
}
