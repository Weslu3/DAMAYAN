import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { RegionPhase } from './update-region-phase.dto.js';
import { IsEnum } from 'class-validator';

export class CreateRegionDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  centerLat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  centerLng!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  @Max(5)
  spanDegrees?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  radiusKm?: number;

  @IsOptional()
  @IsEnum(RegionPhase, { message: 'currentPhase must be one of: beforecalamity, duringcalamity, aftercalamity' })
  currentPhase?: RegionPhase;
}
