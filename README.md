# WhatsApp SaaS Backend (MVP)

Monólito modular em NestJS para uma plataforma multi-tenant de automação de
atendimento via WhatsApp.

## Stack

- NestJS 10 + Node.js 22 + TypeScript
- PostgreSQL + pgvector via Prisma ORM
- Redis + BullMQ (filas e estado)
- JWT (access + refresh) com Argon2 para hashing
- Pino para logging estruturado
- S3/R2 (via @aws-sdk/client-s3) para arquivos

## Módulos incluídos no MVP

- **Auth**: registro, login, refresh, logout (JWT + refresh token rotativo)
- **Users**: perfil do usuário autenticado
- **Tenants**: criação de tenant, convite de membros, RBAC (roles: owner/admin/agent)
- **WhatsApp Sessions**: criação de sessão + fila BullMQ para conexão assíncrona
  (integração real com Evolution API fica no processor, marcado com TODO)
- **Bots**: bot + versões + regras, publicação de versão
- **Contacts**: CRUD de contatos
- **Conversations**: conversas, mensagens, atribuição a agente, fechamento
- **Webhooks**: cadastro de endpoints por tenant

Módulos da modelagem original que **não entraram no MVP** (ficam para
próxima fase, sem exigir refatoração de base): AI settings/prompts,
Knowledge Base com embeddings (tabelas já existem no schema, prontas para
uso), Analytics/daily_metrics (tabela existe, sem endpoints ainda), Billing/
Subscriptions (tabelas existem, sem integração de pagamento), audit_logs
(tabela existe, sem interceptor de escrita automática ainda), API Keys.

## Arquitetura

- Multi-tenant por `tenant_id` em quase todas as tabelas (conforme modelagem)
- `TenantGuard` lê o header `x-tenant-id`, confirma vínculo do usuário
  autenticado com o tenant e injeta `request.tenantId` + role
- `RolesGuard` + decorator `@Roles()` para autorização fina por rota
- `JwtAuthGuard` global (rotas públicas via `@Public()`)
- Filtro de exceção único formatando erros; interceptor de log de requisição
- Separação clara: `common/` (infraestrutura transversal) e `modules/`
  (domínios de negócio), preparada para extrair módulos em microsserviços
  no futuro sem reescrever regras de negócio

## Rodando localmente

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
```

API disponível em `http://localhost:3000/api/v1`.

## Fluxo básico de teste

1. `POST /auth/register` → recebe `accessToken` e `refreshToken`
2. `POST /tenants` (com o accessToken) → cria tenant e vira `owner`
3. Nas rotas de tenant (sessions, bots, contacts, conversations, webhooks),
   enviar header `x-tenant-id: <id do tenant>`

## Próximos passos sugeridos

- Worker dedicado (`main.worker.ts`) rodando os processors do BullMQ em
  processo separado dos endpoints HTTP
- Integração real com Evolution API no `WhatsappSessionsProcessor`
- Módulo de IA (ai_settings, prompts) consumindo `knowledge_chunks` via pgvector
- Interceptor de auditoria automática gravando em `audit_logs`
- Rate limiting por tenant/plano usando os limites da tabela `plans`
