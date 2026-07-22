import { PrismaClient } from '@prisma/client';

/**
 * 🔒 S13 — Seed protegido por NODE_ENV.
 *
 * Nunca rodar em produção. Apenas preenche permissions + plano free,
 * que são dados essenciais em dev/staging.
 */
const PERMISSIONS = [
  'tenant.manage',
  'users.manage',
  'sessions.manage',
  'bots.manage',
  'conversations.manage',
  'conversations.view',
];

async function main() {
  // Fail-closed: se NODE_ENV=production, refuse.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Seed não pode ser executado em produção. Use migrations Prisma (prisma migrate deploy).',
    );
  }

  const prisma = new PrismaClient();

  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  await prisma.plan.upsert({
    where: { id: 'free-plan' },
    update: {},
    create: {
      id: 'free-plan',
      name: 'Free',
      price: 0,
      maxSessions: 1,
      maxUsers: 3,
      maxBots: 1,
      maxMessages: 1000,
      maxStorageMb: 512,
      maxAiRequests: 100,
    },
  });

  console.log('Seed concluído (apenas dev/staging)');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
