import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class DistributionItemDto {
  @IsNotEmpty()
  @IsString()
  itemId!: string;

  @IsInt()
  @Min(1)
  quantityDistributed!: number;

  @IsInt()
  @Min(1)
  recipientCount!: number;
}

export class CreateDistributionDto {
  @IsNotEmpty()
  @IsString()
  operationId!: string;

  @IsNotEmpty()
  @IsString()
  centerId!: string;

  @IsNotEmpty()
  @IsString()
  distributedBy!: string;

  @IsDateString()
  distributionDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @Type(() => DistributionItemDto)
  @IsArray()
  @ValidateNested({ each: true })
  items!: DistributionItemDto[];
}
