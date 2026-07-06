import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthNotificationService } from './customer-auth-notification.service';
import { CustomerAuthController } from './customer-auth.controller';

// FI-1/FI-2 — Customer Identity Platform.
// Isolated from the merchant `auth` module: its own PassportModule import,
// its own JwtModule instance (no default secret — every sign call in
// CustomerAuthService passes CUSTOMER_JWT_SECRET explicitly, so this never
// depends on or shares state with the merchant AuthModule's JwtModule), its
// own 'customer-jwt' strategy/secret. FI-2 adds the REST controller that
// exposes CustomerAuthService over HTTP.
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [CustomerAuthController],
  providers: [CustomerJwtStrategy, CustomerAuthService, CustomerAuthNotificationService],
  exports: [PassportModule, CustomerAuthService],
})
export class CustomerAuthModule {}
