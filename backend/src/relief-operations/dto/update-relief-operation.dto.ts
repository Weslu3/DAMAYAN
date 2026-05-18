import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateReliefOperationDto {
  @IsOptional()
  @IsString()
  disasterId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  leadAgencyId?: string;

  @IsOptional()
  @IsString()
  leadOfficerId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
