import { IsString, Length, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Length(6, 6, { message: 'O código deve ter 6 dígitos' })
  @Matches(/^\d{6}$/, { message: 'O código deve conter apenas números' })
  code: string;
}
