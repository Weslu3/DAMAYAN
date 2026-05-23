import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, MinLength, IsPhoneNumber, IsOptional, IsString } from 'class-validator';
import { AppRole } from '../../../libs/contracts/src/roles.js';

export class SignupDto {
  @IsNotEmpty()
  firstName!: string;

  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    let digits = String(value).replace(/\D/g, '');

    if (digits.startsWith('63')) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    const tenDigits = digits.slice(0, 10);
    return tenDigits.length >= 9 ? `+63${tenDigits}` : undefined;
  })
  @IsPhoneNumber('PH')
  phone?: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsNotEmpty()
  @IsEnum(AppRole, {
    message: 'Role must be one of: admin, dispatcher, line_manager, citizen',
  })
  role!: AppRole;

  @IsOptional()
  @IsNotEmpty()
  governmentIdKey?: string;

  @IsOptional()
  @IsNotEmpty()
  governmentIdFileName?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  barangay?: string;

  @IsOptional()
  @IsString()
  municipality?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  assignedRegionId?: string;
}
