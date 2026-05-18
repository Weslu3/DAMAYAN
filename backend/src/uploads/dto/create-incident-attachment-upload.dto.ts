import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateIncidentAttachmentUploadDto {
  @IsNotEmpty()
  @IsString()
  incidentReportId!: string;

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
