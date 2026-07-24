import { IsNotEmpty, IsString } from 'class-validator';

export class UpgradePlanDto {
  @IsString()
  @IsNotEmpty()
  planId: string;
}
