import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('plans')
export class PlansController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    return this.prisma.plan.findMany({
      orderBy: { price: 'asc' },
      select: {
        id: true,
        name: true,
        price: true,
        maxSessions: true,
        maxUsers: true,
        maxBots: true,
        maxMessages: true,
        maxStorageMb: true,
        maxAiRequests: true,
      },
    });
  }
}
