import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAnimalDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  qrCodeId?: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsString()
  species!: string;

  @IsOptional()
  @IsBoolean()
  needsCage?: boolean;
}
