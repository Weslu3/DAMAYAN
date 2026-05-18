import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateObjectViewUrlDto {
  @IsNotEmpty()
  @IsString()
  bucket!: string;

  @IsNotEmpty()
  @IsString()
  objectPath!: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  expiresIn?: number;
}
