import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
