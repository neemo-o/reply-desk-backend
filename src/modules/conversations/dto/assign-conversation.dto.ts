import { IsString } from 'class-validator';

export class AssignConversationDto {
  @IsString()
  userId: string;
}
