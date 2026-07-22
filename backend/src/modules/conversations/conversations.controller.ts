import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { isUuid } from '../../common/utils/security';
import { MESSAGE_QUEUE } from '../queue/queue.module';

class ListConversationsQuery {
  @IsOptional()
  @IsIn(['open', 'closed', 'pending', 'assigned'])
  status?: 'open' | 'closed' | 'pending' | 'assigned';

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

@UseGuards(TenantGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    @InjectQueue(MESSAGE_QUEUE) private readonly messageQueue: Queue,
  ) {}

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateConversationDto) {
    if (!isUuid(dto.contactId) || !isUuid(dto.sessionId)) {
      throw new BadRequestException('IDs inválidos');
    }
    return this.conversationsService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: ListConversationsQuery,
  ) {
    return this.conversationsService.findAll(tenantId, query.status, {
      take: query.take,
      cursor: query.cursor,
    });
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.conversationsService.findOne(tenantId, id);
  }

  @Post(':id/messages')
  async sendMessage(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.conversationsService.sendMessage(tenantId, id, dto);
    // ⚡ P-QUEUE — job idempotente (jobId único por message)
    await this.messageQueue.add(
      'send-message',
      { messageId: message.id, tenantId },
      { jobId: `send-${message.id}`, removeOnComplete: 200, removeOnFail: 500, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
    return message;
  }

  @Patch(':id/assign')
  assign(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AssignConversationDto,
  ) {
    return this.conversationsService.assign(tenantId, id, dto);
  }

  @Patch(':id/close')
  close(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.conversationsService.close(tenantId, id);
  }
}
