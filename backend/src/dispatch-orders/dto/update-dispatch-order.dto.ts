import { IsOptional, IsString } from 'class-validator';

export class UpdateDispatchOrderDto {
  @IsOptional()
  @IsString()
  disasterId?: string;

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

  @IsOptional()
  @IsString()
  externalVolunteerId?: string;

  @IsOptional()
  @IsString()
  dispatcherAuthUserId?: string;

  @IsOptional()
  isExternalVolunteerDispatch?: boolean;
}
