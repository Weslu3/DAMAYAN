import { IsEnum } from 'class-validator';

export enum SystemPhase {
  BEFORE = 'BEFORE',
  DURING = 'DURING',
  AFTER = 'AFTER',
}

export class UpdatePhaseDto {
  @IsEnum(SystemPhase, { message: 'newPhase must be one of: BEFORE, DURING, AFTER' })
  newPhase: SystemPhase;
}
