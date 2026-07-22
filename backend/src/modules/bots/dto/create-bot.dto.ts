import { IsOptional, IsString } from 'class-validator';

export class CreateBotDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
