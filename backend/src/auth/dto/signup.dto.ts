import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, MinLength, IsPhoneNumber, IsOptional } from 'class-validator';
import { AppRole } from '../../../libs/contracts/src/roles.js';

export class SignupDto {
  @IsNotEmpty()
  firstName!: string;

  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  email!: string;

  @Transform(({ value }) => {
    let digits = String(value ?? '').replace(/\D/g, '');

    if (digits.startsWith('63')) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    return `+63${digits.slice(0, 10)}`;
  })
  @IsPhoneNumber('PH')
  phone!: string;

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
  @IsNotEmpty()
  address?: string;

  @IsOptional()
  @IsNotEmpty()
  barangay?: string;

  @IsOptional()
  @IsNotEmpty()
  municipality?: string;

  @IsOptional()
  @IsNotEmpty()
  province?: string;
}
