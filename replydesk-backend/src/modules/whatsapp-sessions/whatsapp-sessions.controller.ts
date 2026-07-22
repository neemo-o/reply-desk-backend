import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WhatsappSessionsService } from './whatsapp-sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { isUuid } from '../../common/utils/security';
import { SESSION_QUEUE } from '../queue/queue.module';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ListSessionsQuery {
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) take?: number;
}

@UseGuards(TenantGuard)
@Controller('whatsapp-sessions')
export class WhatsappSessionsController {
  constructor(
    private readonly sessionsService: WhatsappSessionsService,
    @InjectQueue(SESSION_QUEUE) private readonly sessionQueue: Queue,
  ) {}

  @Post()
  async create(@CurrentTenant() tenantId: string, @Body() dto: CreateSessionDto) {
    const session = await this.sessionsService.create(tenantId, dto);
    // Enfileira job de conexão (worker processa — ver whatsapp-sessions.processor.ts).
    await this.sessionQueue.add(
      'connect-session',
      { sessionId: session.id, tenantId },
      { jobId: `connect-${session.id}`, removeOnComplete: 100, removeOnFail: 200 },
    );
    return session;
  }

  @Get()
  findAll(@CurrentTenant() tenantId: string, @Query() q: ListSessionsQuery) {
    return this.sessionsService.findAll(tenantId, { take: q.take, cursor: q.cursor });
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.sessionsService.findOne(tenantId, id);
  }

  @Patch(':id/disconnect')
  disconnect(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.sessionsService.disconnect(tenantId, id);
  }
}
