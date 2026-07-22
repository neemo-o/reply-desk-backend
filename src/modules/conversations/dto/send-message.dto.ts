import { IsIn, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsIn(['text', 'image', 'audio', 'video', 'document'])
  type: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;
}
