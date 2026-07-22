import { IsEmail, IsIn, IsString } from 'class-validator';

/**
 * 🔒 S10 — roleName libre para lista fechada (owner / admin / agent).
 *
 * Evita que roles customizadas (ex: typo ou injeção administrativa)
 * sejam fornecidas no invite. Para roles customizadas futuras,
 * migrar para permission-based em vez de string.
 */
export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsIn(['owner', 'admin', 'agent'])
  roleName: 'owner' | 'admin' | 'agent';
}
