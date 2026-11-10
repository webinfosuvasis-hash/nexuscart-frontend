import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { VendorAuthController, VendorAccountController } from './vendor-auth.controller';
import { VendorUsersController } from './vendor-users.controller';
import { VendorAuthService } from './vendor-auth.service';
import { VendorUsersService } from './vendor-users.service';
import { VendorAuthMailer } from './vendor-auth-mailer.service';
import { VendorAuthAudit } from './vendor-auth-audit.service';
import { VendorJwtStrategy } from './strategies/vendor-jwt.strategy';

// Own JwtModule instance with NO default secret: every sign call passes
// VENDOR_JWT_SECRET explicitly, so a vendor token can never be signed with
// the merchant or customer secret by accident.
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [VendorAuthController, VendorAccountController, VendorUsersController],
  providers: [VendorAuthService, VendorUsersService, VendorAuthMailer, VendorAuthAudit, VendorJwtStrategy],
  exports: [VendorJwtStrategy],
})
export class VendorAuthModule {}
