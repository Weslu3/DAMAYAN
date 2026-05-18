import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateIncidentReportDto {
  @IsOptional()
  @IsString()
  disasterId?: string;

  @IsOptional()
  @IsString()
  reportedBy?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => String)
  @IsArray()
  attachmentKeys?: string[];

  @IsOptional()
  @IsString()
  status?: string;
}
