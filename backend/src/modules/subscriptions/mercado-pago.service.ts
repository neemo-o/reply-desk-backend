import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';

const MP_API_BASE = 'https://api.mercadopago.com';

export interface CreatePreapprovalInput {
  reason: string;
  externalReference: string;
  payerEmail: string;
  amount: number;
  backUrl: string;
}

export interface MpPreapproval {
  id: string;
  status: string; // pending | authorized | paused | cancelled
  init_point?: string;
}

/**
 * 🔒 Integração com a API de assinaturas recorrentes (Preapproval) do Mercado Pago.
 *
 * Usa fetch nativo (Node 22) em vez do SDK oficial — API é REST simples e assim
 * evitamos uma dependência extra só para 3 chamadas.
 */
@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);

  constructor(private readonly config: ConfigService) {}

  private get accessToken(): string {
    const token = this.config.get<string>('mercadoPago.accessToken');
    if (!token) {
      throw new BadGatewayException('Integração de pagamento não configurada (MERCADOPAGO_ACCESS_TOKEN ausente)');
    }
    return token;
  }

  private get webhookSecret(): string | undefined {
    return this.config.get<string>('mercadoPago.webhookSecret');
  }

  async createPreapproval(input: CreatePreapprovalInput): Promise<MpPreapproval> {
    const response = await fetch(`${MP_API_BASE}/preapproval`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        // 🔒 Evita reprocessar a criação da assinatura em retries de rede (dedupe no lado do MP)
        'X-Idempotency-Key': input.externalReference,
      },
      body: JSON.stringify({
        reason: input.reason,
        external_reference: input.externalReference,
        payer_email: input.payerEmail,
        back_url: input.backUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: input.amount,
          currency_id: 'BRL',
        },
        status: 'pending',
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Mercado Pago preapproval falhou (${response.status}): ${body}`);
      throw new BadGatewayException('Não foi possível criar a assinatura no Mercado Pago');
    }

    return (await response.json()) as MpPreapproval;
  }

  async getPreapproval(id: string): Promise<MpPreapproval> {
    const response = await fetch(`${MP_API_BASE}/preapproval/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Mercado Pago getPreapproval falhou (${response.status}): ${body}`);
      throw new BadGatewayException('Não foi possível consultar a assinatura no Mercado Pago');
    }

    return (await response.json()) as MpPreapproval;
  }

  /**
   * 🔒 Valida a assinatura HMAC do webhook (header x-signature) conforme o formato
   * documentado pelo Mercado Pago: manifest = "id:{dataId};request-id:{requestId};ts:{ts};"
   *
   * Sem isso, qualquer request para o endpoint público do webhook poderia forjar
   * uma notificação de pagamento aprovado (fraude simples).
   */
  verifyWebhookSignature(params: {
    signatureHeader: string | undefined;
    requestId: string | undefined;
    dataId: string;
  }): boolean {
    const secret = this.webhookSecret;
    // Sem secret configurado (ex.: ambiente de dev sem integração real) — não há como validar.
    if (!secret) return false;
    if (!params.signatureHeader || !params.requestId) return false;

    const parts = Object.fromEntries(
      params.signatureHeader.split(',').map((chunk) => {
        const [key, value] = chunk.split('=');
        return [key?.trim(), value?.trim()];
      }),
    );
    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1) return false;

    const manifest = `id:${params.dataId};request-id:${params.requestId};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(v1, 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  }
}
