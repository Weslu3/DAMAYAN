import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class DistributionItemDto {
  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantityDistributed?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  recipientCount?: number;
}

export class UpdateDistributionDto {
  @IsOptional()
  @IsString()
  operationId?: string;

  @IsOptional()
  @IsString()
  centerId?: string;

  @IsOptional()
  @IsString()
  distributedBy?: string;

  @IsOptional()
  @IsDateString()
  distributionDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => DistributionItemDto)
  @IsArray()
  @ValidateNested({ each: true })
  items?: DistributionItemDto[];
}
