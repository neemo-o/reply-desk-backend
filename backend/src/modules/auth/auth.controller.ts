import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SkipSubscription } from '../../common/decorators/skip-subscription.decorator';

/**
 * 🔒 S8 — Rate-limit dedicado por IP para endpoints /auth.
 *
 * ThrottlerGuard global (100/60s) já está ativo. Aqui apertamos para mitigar
 * credential stuffing / account enumeration em /auth/login e /auth/register.
 *
 * 🔒 M6 — Todo o AuthController é @SkipSubscription() porque:
 * - login/register/refresh/logout são @Public() (não passam por Jwt/Subscription)
 * - verify-email/resend precisam funcionar ANTES do usuário ter assinatura
 * - /auth/me é snapshot do estado do usuário (pode não ter tenant ainda)
 */
@SkipSubscription()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 req/min por IP
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 req/min por IP
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } }) // 20 req/min por IP (rotação)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  // Requer JWT (usuário já logado, mas ainda não verificado) — não é @Public().
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 tentativas/min — força bruta no código
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@CurrentUser('sub') userId: string, @Body() dto: VerifyEmailDto) {
    return this.emailVerificationService.verify(userId, dto.code);
  }

  // 🔒 M5 — Snapshot do estado do usuário (email verificado?, tem tenant?, subscription ativa?)
  @Get('me')
  me(@CurrentUser('sub') userId: string) {
    return this.authService.getMeSnapshot(userId);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@CurrentUser('sub') userId: string, @CurrentUser('email') email: string) {
    return this.emailVerificationService.resend(userId, email);
  }
}
