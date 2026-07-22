# 📈 E2+E8 — Dockerfile para API e Worker via CMD override.
#
# Build:  docker build -t whatsapp-saas-backend .
# Run API:    docker run ... whatsapp-saas-backend                # usa CMD default
# Run Worker: docker run ... whatsapp-saas-backend node dist/src/worker.js
#
# Em produção, o docker-compose.prod.yml controla os CMDs separados.
# Multi-stage reduz superfície (não traz dev-deps).
# Usuário não-root reduz privilégios.
# Healthcheck no CMD default (API).

# ----------- ESTÁGIO 1: builder (deps + TS + Prisma) -----------
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl ca-certificates
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npx nest build
RUN npx nest build -p tsconfig.worker.json
# O worker build gera arquivos em dist-worker/ (outDir custom)
# Vamos consolidar tudo em dist/ mantendo nomes únicos:
RUN cp -r dist-worker/src dist/ || true

# ----------- ESTÁGIO 2: runtime (imagem final) -----------
FROM node:22-alpine
RUN apk add --no-cache openssl ca-certificates curl
WORKDIR /app
ENV NODE_ENV=production

# Copia só prod deps
COPY package*.json ./
RUN npm install --omit=dev

# Copia Prisma Client gerado pelo builder (não vem no --omit=dev)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copia Prisma schema + build artifacts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Dropa privilégios para o usuário node (já existe na imagem base alpine)
USER node

EXPOSE 3000

# 📈 Default é API. Worker é invocado por override no docker-compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/src/main.js"]
