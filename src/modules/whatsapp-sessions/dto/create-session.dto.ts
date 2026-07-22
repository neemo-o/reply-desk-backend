import { IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
