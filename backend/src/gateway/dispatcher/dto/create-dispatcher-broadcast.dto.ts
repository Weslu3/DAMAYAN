import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateDispatcherBroadcastDto {
  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsIn(['info', 'warning', 'critical', 'evacuation'])
  severity?: 'info' | 'warning' | 'critical' | 'evacuation';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  areas?: string[];
}
