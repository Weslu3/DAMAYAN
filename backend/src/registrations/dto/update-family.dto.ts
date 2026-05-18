import { IsOptional, IsString } from 'class-validator';

export class UpdateFamilyDto {
  @IsOptional()
  @IsString()
  qrCodeId?: string;

  @IsOptional()
  @IsString()
  headUserId?: string;

  @IsOptional()
  @IsString()
  headFullName?: string;

  @IsOptional()
  @IsString()
  familyMemberName?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  age?: number;

  @IsOptional()
  @IsString()
  accessibilityNeeds?: string;
}
