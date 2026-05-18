import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { AppRole } from '../../../libs/contracts/src/roles.js';

export class LoginDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  rememberMe?: boolean;

  @IsOptional()
  @IsEnum(AppRole)
  requiredRole?: AppRole;
}
