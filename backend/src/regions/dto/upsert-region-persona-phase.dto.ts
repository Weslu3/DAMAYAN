import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { AppRole } from '../../../libs/contracts/src/roles.js';

export enum RegionPersonaPhase {
  BEFORE = 'BEFORE',
  DURING = 'DURING',
  AFTER = 'AFTER',
}

export class UpsertRegionPersonaPhaseDto {
  @IsEnum(AppRole, { message: 'personaRole must be one of: admin, dispatcher, line_manager, citizen' })
  personaRole!: AppRole;

  @IsEnum(RegionPersonaPhase, { message: 'phase must be one of: BEFORE, DURING, AFTER' })
  phase!: RegionPersonaPhase;

  @IsOptional()
  @IsBoolean()
  visibleToAssignedUsers?: boolean;
}