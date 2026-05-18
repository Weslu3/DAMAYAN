import { IsNotEmpty, IsString } from 'class-validator';

export class CreateGovernmentIdUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  applicantRole!: string;

  @IsString()
  @IsNotEmpty()
  applicantEmail!: string;
}
