import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertAfterActionAssessmentDto {
  @IsNotEmpty()
  @IsString()
  disasterId!: string;

  @IsNotEmpty()
  @IsString()
  infraStatus!: string;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  estimatedCost!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  reliefNeeded!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  durationDays!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  shelterRating!: number;

  @IsNotEmpty()
  @IsString()
  successNotes!: string;

  @IsNotEmpty()
  @IsString()
  bottlenecks!: string;

  @IsOptional()
  @IsString()
  submittedBy?: string;
}
