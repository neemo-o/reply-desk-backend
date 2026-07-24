import { Body, Controller, Delete, Get, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { SkipSubscription } from '../../common/decorators/skip-subscription.decorator';

/**
 * 🔒 M6 — @SkipSubscription(): /users/me não deve ser bloqueado por falta de
 * assinatura. O usuário precisa acessar seus próprios dados mesmo sem tenant
 * ou com assinatura expirada.
 */
@SkipSubscription()
@UseGuards(TenantGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser('sub') userId: string) {
    return this.usersService.findById(userId);
  }

  @Patch('me')
  updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(userId, dto);
  }

  @Delete('me')
  deleteMe(@CurrentUser('sub') userId: string) {
    return this.usersService.softDelete(userId);
  }
}
