import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 🔒 S7 — Filter que NÃO vaza stack traces em produção.
 *
 * - Body e Stack só expostos em development.
 * - Erros 5xx são logados, com stack + message reduzida, sem parâmetros de query/arguments.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isProd = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Erro interno do servidor';

    if (status >= 500) {
      // Log estruturado, sem o request body nem authorization headers.
      const err = exception as Error;
      this.logger.error({
        path: request.url,
        method: request.method,
        name: err?.name,
        message: err?.message,
        stack: this.isProd ? undefined : err?.stack,
      });
    }

    // Para o client: payloads de HttpException são seguros (criados pela app).
    // Strings cruas ou errors 5xx viram mensagem genérica em produção.
    let safeMessage: unknown = rawMessage;
    if (status >= 500 && this.isProd && !(exception instanceof HttpException)) {
      safeMessage = { message: 'Erro interno do servidor' };
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message: safeMessage,
    });
  }
}
