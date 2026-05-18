import { IsNumber } from 'class-validator';

export class AdjustQuantityDto {
  @IsNumber()
  adjustment: number; // Can be positive or negative (e.g., +10, -10, +1, -1)
}
