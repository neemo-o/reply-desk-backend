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

  const PLANS = [
    {
      id: 'basic-plan',
      name: 'Basic',
      price: 49.9,
      maxSessions: 1,
      maxUsers: 3,
      maxBots: 1,
      maxMessages: 2000,
      maxStorageMb: 512,
      maxAiRequests: 0, // sem IA — fluxo por opções/regras
    },
    {
      id: 'premium-plan',
      name: 'Premium',
      price: 99.9,
      maxSessions: 3,
      maxUsers: 10,
      maxBots: 5,
      maxMessages: 10000,
      maxStorageMb: 2048,
      maxAiRequests: 5000,
    },
  ];

  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }

  console.log('Seed concluído (apenas dev/staging)');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
