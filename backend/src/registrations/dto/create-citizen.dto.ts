import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCitizenDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsNotEmpty()
  @IsString()
  registrationType!: string;

  @IsNotEmpty()
  @IsString()
  qrCodeId!: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactNumber?: string;

  @IsOptional()
  @IsString()
  familyId?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  bloodType?: string;

  @IsOptional()
  @IsString()
  medicalConditions?: string;
}
