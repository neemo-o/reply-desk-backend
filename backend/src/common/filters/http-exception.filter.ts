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

    const rawResponse =
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

    // Normaliza para string | string[]. Nunca aninha objeto em `message`,
    // pois o frontend (sonner/React) não sabe renderizar objeto como child.
    let safeMessage: string | string[];
    if (typeof rawResponse === 'string') {
      safeMessage = rawResponse;
    } else if (Array.isArray((rawResponse as { message?: unknown }).message)) {
      // ValidationPipe BadRequest: { message: ['...', '...'], error: 'Bad Request' }
      safeMessage = (rawResponse as { message: string[] }).message;
    } else if (typeof (rawResponse as { message?: unknown }).message === 'string') {
      safeMessage = (rawResponse as { message: string }).message;
    } else if (Array.isArray(rawResponse)) {
      safeMessage = rawResponse as string[];
    } else if (this.isProd && status >= 500) {
      safeMessage = 'Erro interno do servidor';
    } else {
      // Fallback: serializa qualquer formato exótico para evitar objeto no payload.
      safeMessage = JSON.stringify(rawResponse);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message: safeMessage,
    });
  }
}
