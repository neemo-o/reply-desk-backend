import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokensService } from './tokens.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/**
 * 🔒 P3 — argon2.hash com custos ajustados para 2vCPU/4GB.
 * Defaults (memoryCost 65536) saturam memória sob carga simultânea.
 */
const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokensService: TokensService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await argon2.hash(dto.password, ARGON2_OPTS);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash },
    });

    return this.issueTokens(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return this.issueTokens(user.id, user.email);
  }

  async refresh(refreshToken: string) {
    const result = await this.tokensService.verifyRefreshToken(refreshToken);
    if (!result) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    await this.tokensService.revokeRefreshToken(result.tokenRecordId);

    const user = await this.prisma.user.findUnique({ where: { id: result.payload.sub } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return this.issueTokens(user.id, user.email);
  }

  async logout(refreshToken: string) {
    const result = await this.tokensService.verifyRefreshToken(refreshToken);
    if (result) {
      await this.tokensService.revokeRefreshToken(result.tokenRecordId);
    }
    return { success: true };
  }

  private async issueTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokensService.generateAccessToken(userId, email),
      this.tokensService.generateRefreshToken(userId),
    ]);
    return { accessToken, refreshToken };
  }
}
