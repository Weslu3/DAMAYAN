import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  operationId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minRequired?: number;
}
