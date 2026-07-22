import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateBotRuleDto {
  @IsString()
  trigger: string;

  @IsIn(['text', 'flow', 'ai'])
  responseType: string;

  @IsOptional()
  @IsInt()
  priority?: number;
}
