import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseExpiresInToMs } from '../../common/utils/security';

/**
 * 🔒 S4+S5 — TokensService O(1) via jti + cleanup + expiresAt derivado do config.
 *
 * Mudanças:
 * - `payload.jti` agora é igual ao `RefreshToken.id` (UUID). Refresh rotate = find by id.
 * - `expiresAt` calculado a partir de `JWT_REFRESH_EXPIRES_IN` (não mais hard-code +7d).
 * - Lookup O(1) em vez de O(n) com argon2.verify por loop.
 *
 * Mantido: o client recebe refresh tokens opacos (raw), o DB armazena argon2 hash.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async generateAccessToken(userId: string, email: string) {
    return this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn') ?? '15m',
        algorithm: 'HS256',
      },
    );
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const ttlMs = parseExpiresInToMs(refreshExpiresIn);
    const expiresAt = new Date(Date.now() + ttlMs);

    // Cria primeiro o registro para obter UUID (será jti do JWT)
    const created = await this.prisma.refreshToken.create({
      data: { userId, tokenHash: 'pending', expiresAt },
    });

    const token = await this.jwtService.signAsync(
      { sub: userId, jti: created.id },
      {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
        algorithm: 'HS256',
      },
    );

    const tokenHash = await argon2.hash(token);
    await this.prisma.refreshToken.update({
      where: { id: created.id },
      data: { tokenHash },
    });

    return token;
  }

  /**
   * Verifica um refresh token e devolve o id do registro se válido.
   * Lança UnauthorizedException se inválido (mantém compatibilidade).
   */
  async verifyRefreshToken(token: string): Promise<{ payload: any; tokenRecordId: string } | null> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        algorithms: ['HS256'],
      });
    } catch {
      return null;
    }

    if (!payload?.jti || !payload?.sub) return null;

    // O(1): lookup direto do registro pelo id (que é o jti).
    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti as string },
    });

    if (!stored) return null;
    if (stored.revoked) return null;
    if (stored.expiresAt.getTime() < Date.now()) return null;
    if (stored.userId !== payload.sub) return null;

    // Confirma que o token bruto bate com o hash registrado (proteção contra token
    // falsificado com mesmo jti).
    const ok = await argon2.verify(stored.tokenHash, token);
    if (!ok) return null;

    return { payload, tokenRecordId: stored.id };
  }

  async revokeRefreshToken(tokenRecordId: string) {
    await this.prisma.refreshToken.update({
      where: { id: tokenRecordId },
      data: { revoked: true },
    });
  }
}
