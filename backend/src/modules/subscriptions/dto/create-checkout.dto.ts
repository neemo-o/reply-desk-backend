import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsOptional()
  @IsIn(['recurring', 'one_time'])
  billingType?: 'recurring' | 'one_time';
}
