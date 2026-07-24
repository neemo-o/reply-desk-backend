import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { MailService } from '../../common/mail/mail.service';

const CODE_TTL_SECONDS = 10 * 60; // 10 minutos
const RESEND_COOLDOWN_SECONDS = 60; // 1 minuto entre reenvios
const MAX_ATTEMPTS = 5;

function codeKey(userId: string) {
  return `email-otp:code:${userId}`;
}
function cooldownKey(userId: string) {
  return `email-otp:cooldown:${userId}`;
}
function attemptsKey(userId: string) {
  return `email-otp:attempts:${userId}`;
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * 🔒 Fluxo de verificação de e-mail (OTP numérico de 6 dígitos):
 * - Código é armazenado como hash SHA-256 no Redis (nunca em texto puro), com TTL de 10 min.
 * - Reenvio tem cooldown de 60s (evita spam de e-mail / abuso do provedor SMTP).
 * - Máximo de 5 tentativas de verificação por código — depois disso, precisa pedir um novo.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
  ) {}

  async sendInitialCode(userId: string, email: string): Promise<void> {
    // Erro ao enviar o e-mail não deve derrubar o cadastro do usuário —
    // ele ainda pode pedir reenvio depois. Só logamos.
    try {
      await this.issueAndSendCode(userId, email);
    } catch (err) {
      this.logger.error(`Falha ao enviar OTP inicial para ${email}`, err as Error);
    }
  }

  async resend(userId: string, email: string): Promise<{ retryAfterSeconds: number }> {
    const cooldownTtl = await this.redis.ttl(cooldownKey(userId));
    if (cooldownTtl > 0) {
      throw new HttpException(
        { message: `Aguarde ${cooldownTtl}s para solicitar um novo código`, retryAfterSeconds: cooldownTtl },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.issueAndSendCode(userId, email);
    return { retryAfterSeconds: RESEND_COOLDOWN_SECONDS };
  }

  async verify(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuário não encontrado');
    if (user.emailVerified) return; // já verificado — idempotente

    const storedHash = await this.redis.get(codeKey(userId));
    if (!storedHash) {
      throw new BadRequestException('Código expirado ou inexistente — solicite um novo');
    }

    const attempts = await this.redis.incr(attemptsKey(userId));
    if (attempts === 1) {
      await this.redis.expire(attemptsKey(userId), CODE_TTL_SECONDS);
    }
    if (attempts > MAX_ATTEMPTS) {
      await this.redis.del(codeKey(userId));
      throw new BadRequestException('Muitas tentativas incorretas — solicite um novo código');
    }

    const providedHash = hashCode(code);
    const storedBuf = Buffer.from(storedHash, 'hex');
    const providedBuf = Buffer.from(providedHash, 'hex');
    const matches = storedBuf.length === providedBuf.length && timingSafeEqual(storedBuf, providedBuf);

    if (!matches) {
      throw new BadRequestException('Código inválido');
    }

    await Promise.all([this.redis.del(codeKey(userId)), this.redis.del(attemptsKey(userId))]);
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
  }

  private async issueAndSendCode(userId: string, email: string): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

    await this.redis.set(codeKey(userId), hashCode(code), 'EX', CODE_TTL_SECONDS);
    await this.redis.set(cooldownKey(userId), '1', 'EX', RESEND_COOLDOWN_SECONDS);
    await this.redis.del(attemptsKey(userId));

    await this.mail.sendVerificationOtp(email, code);
  }
}
