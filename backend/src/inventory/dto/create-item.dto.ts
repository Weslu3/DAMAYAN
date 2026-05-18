import { IsNotEmpty, IsString, IsNumber, Min, IsOptional } from 'class-validator';

export class CreateItemDto {
  @IsNotEmpty()
  @IsString()
  operationId!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsString()
  category!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNotEmpty()
  @IsString()
  unit!: string;

  @IsNotEmpty()
  @IsString()
  source!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsNumber()
  @Min(1)
  minRequired!: number;
}
