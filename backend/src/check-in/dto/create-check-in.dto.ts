import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateCheckInDto {
  @IsNotEmpty()
  @IsString()
  evacueeNumber: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  centerId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  familySize?: number;
}
