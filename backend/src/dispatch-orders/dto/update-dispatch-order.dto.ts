import { IsOptional, IsString } from 'class-validator';

export class UpdateDispatchOrderDto {
  @IsOptional()
  @IsString()
  reportId?: string;

  @IsOptional()
  @IsString()
  operationId?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
