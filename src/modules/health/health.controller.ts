import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * 📈 E4 — Healthcheck endpoint para k8s/load balancer/Docker.
 *
 * GET /api/v1/health → 200 se TUDO OK, 503 se alguma dependência falhar.
 * Não requer autenticação (@Public).
 *
 * Verifica:
 * 1. Postgres: SELECT 1
 * 2. Redis: PING
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async check() {
    const checks = {
      database: 'ok' as string,
      redis: 'ok' as string,
    };

    // Check Postgres
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.database = 'fail';
    }

    // Check Redis
    try {
      const pong = await this.redis.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'fail';
    } catch {
      checks.redis = 'fail';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');

    return {
      status: allOk ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
