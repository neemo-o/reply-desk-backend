import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { MailService } from '../../common/mail/mail.service';
import { TenantsService } from '../tenants/tenants.service';

const CODE_TTL_SECONDS = 10 * 60; // 10 minutos
const RESEND_COOLDOWN_SECONDS = 60; // 1 minuto entre reenvios
const MAX_ATTEMPTS = 5;
const MAX_RESENDS_PER_DAY = 20; // 🔒 E4 — limite total de reenvios por dia

function codeKey(userId: string) {
  return `email-otp:code:${userId}`;
}
function cooldownKey(userId: string) {
  return `email-otp:cooldown:${userId}`;
}
function attemptsKey(userId: string) {
  return `email-otp:attempts:${userId}`;
}
function resendCountKey(userId: string) {
  return `email-otp:resend-count:${userId}`;
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * 🔒 Fluxo de verificação de e-mail (OTP numérico de 6 dígitos):
 * - Código é armazenado como hash SHA-256 no Redis (nunca em texto puro), com TTL de 10 min.
 * - Reenvio tem cooldown de 60s (evita spam de e-mail / abuso do provedor SMTP).
 * - Máximo de 5 tentativas de verificação por código — depois disso, precisa pedir um novo.
 * - 🔒 E4 — Máximo de 20 reenvios por dia por usuário.
 * - 🔒 E3 — Se o Redis cair, retorna ServiceUnavailableException em vez de crashar.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly tenantsService: TenantsService,
  ) {}

  async sendInitialCode(userId: string, email: string): Promise<void> {
    // Erro ao enviar o e-mail não deve derrubar o cadastro do usuário —
    // ele ainda pode pedir reenvio depois. Só logamos.
    try {
      await this.issueAndSendCode(userId, email);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.error(`Falha ao enviar OTP inicial para ${email}`, err as Error);
    }
  }

  async resend(userId: string, email: string): Promise<{ retryAfterSeconds: number }> {
    // 🔒 E3 — Verifica disponibilidade do Redis antes de prosseguir
    await this.assertRedisAvailable();

    const cooldownTtl = await this.redis.ttl(cooldownKey(userId));
    if (cooldownTtl > 0) {
      throw new HttpException(
        { message: `Aguarde ${cooldownTtl}s para solicitar um novo código`, retryAfterSeconds: cooldownTtl },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 🔒 E4 — Limite total de reenvios por dia
    const resendCount = await this.redis.incr(resendCountKey(userId));
    if (resendCount === 1) {
      // Primeiro reenvio do dia — seta TTL de 24h no contador
      await this.redis.expire(resendCountKey(userId), 24 * 60 * 60);
    }
    if (resendCount > MAX_RESENDS_PER_DAY) {
      const ttl = await this.redis.ttl(resendCountKey(userId));
      throw new HttpException(
        { message: `Limite diário de ${MAX_RESENDS_PER_DAY} reenvios atingido. Tente novamente em ${Math.ceil(ttl / 3600)}h.`, retryAfterSeconds: ttl },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.issueAndSendCode(userId, email);
    return { retryAfterSeconds: RESEND_COOLDOWN_SECONDS };
  }

  async verify(userId: string, code: string): Promise<void> {
    // 🔒 E3 — Verifica disponibilidade do Redis antes de prosseguir
    await this.assertRedisAvailable();

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

    // 🔒 M1 — Cria tenant automático após verificação de email.
    // Antes o usuário verificava email e ficava sem tenant, precisando criar
    // manualmente via POST /tenants. Agora criamos o tenant inicial automaticamente.
    // Se já tem tenant (edge case: re-verificação), ignoramos.
    await this.ensureTenantForUser(userId);
  }

  /**
   * 🔒 E3 — Verifica se o Redis está acessível. Se caiu, lança 503 em vez
   * de deixar exceções não tratadas subirem como 500 genérico.
   * O retry do ioredis já tenta 3 vezes, então se chegar aqui, Redis está realmente fora.
   */
  private async assertRedisAvailable(): Promise<void> {
    try {
      await this.redis.ping();
    } catch {
      this.logger.error('Redis indisponível — fluxo de verificação de email não pode continuar');
      throw new ServiceUnavailableException('Serviço temporariamente indisponível — tente novamente em instantes');
    }
  }

  /**
   * 🔒 M1 — Garante que o usuário tem pelo menos um tenant após verificar email.
   * Cria um tenant com slug derivado do nome do usuário + uuid curto.
   * Idempotente: se o usuário já tem tenant, não cria outro.
   */
  private async ensureTenantForUser(userId: string): Promise<void> {
    try {
      const existingTenants = await this.prisma.tenantUser.findMany({
        where: { userId },
        select: { id: true },
        take: 1,
      });
      if (existingTenants.length > 0) return;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      if (!user) return;

      // Deriva o nome do tenant do nome do usuário (ex: "João Silva" → "João Silva")
      const tenantName = `${user.name}'s Workspace`;
      const slugBase = user.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const uniqueSuffix = userId.slice(0, 8);
      const slug = `${slugBase || 'workspace'}-${uniqueSuffix}`;

      await this.tenantsService.create(userId, {
        name: tenantName,
        slug,
        timezone: 'America/Sao_Paulo',
      });

      this.logger.log(`Tenant auto-criado para usuário ${userId} (${user.email})`);
    } catch (err) {
      // Erro ao criar tenant não deve falhar a verificação de email.
      // O usuário pode criar via POST /tenants depois.
      this.logger.error(`Falha ao auto-criar tenant para usuário ${userId}: ${(err as Error).message}`);
    }
  }

  private async issueAndSendCode(userId: string, email: string): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

    await this.redis.set(codeKey(userId), hashCode(code), 'EX', CODE_TTL_SECONDS);
    await this.redis.set(cooldownKey(userId), '1', 'EX', RESEND_COOLDOWN_SECONDS);
    await this.redis.del(attemptsKey(userId));

    await this.mail.sendVerificationOtp(email, code);
  }
}
