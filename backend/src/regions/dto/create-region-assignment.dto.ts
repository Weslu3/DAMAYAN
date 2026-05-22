import { IsIn, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateRegionAssignmentDto {
  @IsNotEmpty()
  @IsString()
  authUserId!: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['site_manager', 'dispatcher'])
  role!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
