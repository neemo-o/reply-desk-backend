import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateContactDto {
  @IsString()
  @Matches(/^[\d\s\-()+ ]*$/, { message: 'Telefone inválido (apenas dígitos, espaços e +, -, () são aceitos)' })
  @MinLength(8)
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;
}
