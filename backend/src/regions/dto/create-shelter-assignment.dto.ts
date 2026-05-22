import { IsNotEmpty, IsString } from 'class-validator';

export class CreateShelterAssignmentDto {
  @IsNotEmpty()
  @IsString()
  centerId!: string;

  @IsNotEmpty()
  @IsString()
  managerId!: string;
}
