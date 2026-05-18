import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateReliefOperationDto {
  @IsNotEmpty()
  @IsString()
  disasterId!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  leadAgencyId?: string;

  @IsNotEmpty()
  @IsString()
  leadOfficerId!: string;

  @IsOptional()
  @IsString()
  status?: string;
}
