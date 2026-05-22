import { IsEnum } from 'class-validator';

export enum RegionPhase {
  BEFORE = 'beforecalamity',
  DURING = 'duringcalamity',
  AFTER = 'aftercalamity',
}

export class UpdateRegionPhaseDto {
  @IsEnum(RegionPhase, { message: 'newPhase must be one of: beforecalamity, duringcalamity, aftercalamity' })
  newPhase!: RegionPhase;
}
