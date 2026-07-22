import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

/**
 * ⚡ P8 — Logger com verbosity reduzida em produção.
 *
 * - pino-pretty só em desenvolvimento (gera texto bonito para o console).
 * - Em produção, saída JSON estruturada (consumível por Datadog/Loki/CloudWatch).
 * - `redact` cobre headers sensíveis E password fields em payloads.
 */
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        // Em produção: sem pretty (JSON puro). Em dev: pretty.
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        // Redact paths comuns de PII/segredos antes de logar.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.refreshToken',
            'res.body.accessToken',
            'res.body.refreshToken',
          ],
          remove: true,
        },
        autoLogging: process.env.NODE_ENV !== 'production',
        // Trunca responses muito grandes para não explodir logs.
        serializers: {
          req(req) {
            return { method: req.method, url: req.url, id: req.id };
          },
        },
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
