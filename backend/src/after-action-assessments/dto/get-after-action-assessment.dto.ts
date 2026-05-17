import { IsOptional, IsString } from 'class-validator';

export class GetAfterActionAssessmentDto {
  @IsOptional()
  @IsString()
  disasterId?: string;
}
