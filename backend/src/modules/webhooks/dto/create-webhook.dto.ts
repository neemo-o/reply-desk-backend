import { IsArray, IsString } from 'class-validator';
import { IsPublicHttpsUrl } from '../../../common/decorators/is-public-https-url.decorator';

/**
 * 🔒 S12 — CreateWebhookDto: valida URL externa pública e HTTPS.
 *
 * Bloqueia: loopback, IPs privados (RFC1918), metadata services
 * (AWS/GCP/Azure), .local/.internal. Evita SSRF interno do backend.
 */
export class CreateWebhookDto {
  @IsString()
  name: string;

  @IsPublicHttpsUrl()
  url: string;

  @IsArray()
  @IsString({ each: true })
  events: string[];
}
