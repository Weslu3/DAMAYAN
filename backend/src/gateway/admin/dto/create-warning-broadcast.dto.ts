import { IsArray, IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class CreateWarningBroadcastDto {
  @IsNotEmpty()
  @IsString()
  type!: string;

  @IsNotEmpty()
  @IsString()
  severity!: string;

  @IsArray()
  @IsString({ each: true })
  areas!: string[];

  @IsNotEmpty()
  @IsString()
  message!: string;

  @IsBoolean()
  useSMS!: boolean;

  @IsBoolean()
  usePush!: boolean;
}