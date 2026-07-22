import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateTenantDto) {
    return this.tenantsService.create(userId, dto);
  }

  @Get('mine')
  findMine(@CurrentUser('sub') userId: string) {
    return this.tenantsService.findMine(userId);
  }

  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  @Post('members')
  invite(@CurrentTenant() tenantId: string, @Body() dto: InviteUserDto) {
    return this.tenantsService.inviteUser(tenantId, dto);
  }

  @UseGuards(TenantGuard)
  @Get('members')
  listMembers(@CurrentTenant() tenantId: string) {
    return this.tenantsService.listMembers(tenantId);
  }
}
