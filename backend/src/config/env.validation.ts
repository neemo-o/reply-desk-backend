import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Matches, MinLength, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  REDIS_PORT: number = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  // 🔒 S3 — Segredos JWT precisam de no mínimo 32 caracteres (256 bits de entropia mínima)
  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET deve ter no mínimo 32 caracteres' })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET deve ter no mínimo 32 caracteres' })
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRES_IN?: string;

  // 🔒 S1 — Lista de origens permitidas para CORS (separadas por vírgula)
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  // 🔒 Stripe — chaves de API e webhook
  @IsOptional()
  @IsString()
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsString()
  @Matches(/^https:\/\//, { message: 'STRIPE_CHECKOUT_SUCCESS_URL deve ser HTTPS' })
  STRIPE_CHECKOUT_SUCCESS_URL?: string;

  @IsOptional()
  @IsString()
  @Matches(/^https:\/\//, { message: 'STRIPE_CHECKOUT_CANCEL_URL deve ser HTTPS' })
  STRIPE_CHECKOUT_CANCEL_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  // 🔒 S3 fail-closed adicional em produção — secrets default nunca passam
  if (validatedConfig.NODE_ENV === Environment.Production) {
    if (
      validatedConfig.JWT_ACCESS_SECRET.startsWith('change-me') ||
      validatedConfig.JWT_REFRESH_SECRET.startsWith('change-me')
    ) {
      throw new Error('JWT secrets default (change-me-*) não são permitidos em produção.');
    }
    if (!validatedConfig.CORS_ORIGINS) {
      throw new Error('CORS_ORIGINS é obrigatório em produção — defina as origens permitidas separadas por vírgula.');
    }
    if (!validatedConfig.STRIPE_SECRET_KEY || !validatedConfig.STRIPE_WEBHOOK_SECRET) {
      throw new Error(
        'STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET são obrigatórios em produção.',
      );
    }
    if (!validatedConfig.STRIPE_CHECKOUT_SUCCESS_URL || !validatedConfig.STRIPE_CHECKOUT_CANCEL_URL) {
      throw new Error('STRIPE_CHECKOUT_SUCCESS_URL e STRIPE_CHECKOUT_CANCEL_URL são obrigatórios em produção.');
    }
  }

  return validatedConfig;
}
