import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BotsService } from './bots.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { CreateBotRuleDto } from './dto/create-bot-rule.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

// 🔒 M6 — SubscriptionGuard agora é global (APP_GUARD em AppModule).
@UseGuards(TenantGuard)
@Controller('bots')
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateBotDto) {
    return this.botsService.create(tenantId, dto);
  }

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.botsService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.botsService.findOne(tenantId, id);
  }

  @Post(':id/versions/:version/rules')
  addRule(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('version') version: string,
    @Body() dto: CreateBotRuleDto,
  ) {
    return this.botsService.addRule(tenantId, id, Number(version), dto);
  }

  @Patch(':id/versions/:version/publish')
  publish(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('version') version: string,
  ) {
    return this.botsService.publish(tenantId, id, Number(version));
  }
}
