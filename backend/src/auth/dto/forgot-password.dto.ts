import {
  IsEmail,
  IsPhoneNumber,
  IsEnum,
  ValidateIf,
  IsOptional,
  IsString,
} from 'class-validator';

export enum RecoveryMethod {
  SMS = 'sms',
  EMAIL = 'email',
}

export class ForgotPasswordDto {
  @IsOptional()
  @IsEnum(RecoveryMethod)
  method?: RecoveryMethod;

  @ValidateIf((o: ForgotPasswordDto) => o.method === RecoveryMethod.EMAIL)
  @IsEmail()
  email?: string;

  @ValidateIf((o: ForgotPasswordDto) => o.method === RecoveryMethod.SMS)
  @IsPhoneNumber('PH')
  phone?: string;

  @IsOptional()
  @IsString()
  contact?: string;
}
