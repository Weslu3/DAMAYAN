import {
  IsNotEmpty,
  MinLength,
  IsString,
  Length,
  IsOptional,
} from 'class-validator';

export class ResetPasswordDto {
  @IsOptional()
  @IsString()
  @Length(4, 4)
  code?: string;

  @IsOptional()
  @IsString()
  @Length(4, 4)
  verificationCode?: string;

  @IsNotEmpty()
  @MinLength(6)
  newPassword!: string;

  @IsNotEmpty()
  contact!: string; // masked contact from session
}
