import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@UseGuards(TenantGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  getCurrent(@CurrentTenant() tenantId: string) {
    return this.subscriptionsService.getCurrent(tenantId);
  }

  // Só owner/admin podem contratar/trocar de plano.
  @Roles('owner', 'admin')
  @Post('checkout')
  createCheckout(@CurrentTenant() tenantId: string, @Body() dto: CreateCheckoutDto) {
    return this.subscriptionsService.createCheckout(tenantId, dto.planId);
  }
}
