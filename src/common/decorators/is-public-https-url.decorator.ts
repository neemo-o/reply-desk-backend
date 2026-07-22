import {
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { isPublicHttpsUrl } from '../utils/security';

/**
 * 🔒 S12 — Decorator de validação: URL pública HTTPS (rejeita loopback / IPs privados / metadata).
 *
 * @example
 *   @IsPublicHttpsUrl()
 *   url: string;
 */
export function IsPublicHttpsUrl(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'isPublicHttpsUrl',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          return isPublicHttpsUrl(value);
        },
        defaultMessage() {
          return 'URL deve ser HTTPS pública (sem loopback, IPs privados ou metadata services)';
        },
      },
    });
  };
}
