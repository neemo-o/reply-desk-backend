import { IsString } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  contactId: string;

  @IsString()
  sessionId: string;
}
