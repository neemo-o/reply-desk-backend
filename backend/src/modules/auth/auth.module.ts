import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokensService } from './tokens.service';
import { EmailVerificationService } from './email-verification.service';
import { RefreshTokenCleanupJob } from './refresh-token-cleanup.job';
import { UnverifiedUserCleanupJob } from './unverified-user-cleanup.job';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), TenantsModule],
  controllers: [AuthController],
  providers: [AuthService, TokensService, EmailVerificationService, JwtStrategy, RefreshTokenCleanupJob, UnverifiedUserCleanupJob],
})
export class AuthModule {}
