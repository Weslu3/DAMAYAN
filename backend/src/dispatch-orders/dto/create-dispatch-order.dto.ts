import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDispatchOrderDto {
  @IsNotEmpty()
  @IsString()
  reportId!: string;

  @IsNotEmpty()
  @IsString()
  operationId!: string;

  @IsNotEmpty()
  @IsString()
  assignedTo!: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  disasterId?: string;

  @IsOptional()
  @IsString()
  externalVolunteerId?: string;

  @IsOptional()
  @IsString()
  dispatcherAuthUserId?: string;

  @IsOptional()
  isExternalVolunteerDispatch?: boolean;
}
