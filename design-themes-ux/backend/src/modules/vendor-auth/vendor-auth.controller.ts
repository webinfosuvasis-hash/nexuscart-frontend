import {
  Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { VendorAuthService, VendorSession } from './vendor-auth.service';
import { VendorJwtAuthGuard } from './guards/vendor-jwt-auth.guard';
import { CurrentVendor } from './decorators/current-vendor.decorator';
import { AuthenticatedVendor, VENDOR_REFRESH_COOKIE, VENDOR_REFRESH_COOKIE_PATH } from './vendor-auth.types';
import {
  VendorAcceptInviteDto, VendorChangePasswordDto, VendorForgotPasswordDto, VendorLoginDto,
  VendorResetPasswordDto, VendorUpdateProfileDto,
} from './dto/vendor-auth.dto';

const STRICT = { short: { ttl: 60_000, limit: 5 }, medium: { ttl: 3_600_000, limit: 30 } };

/**
 * Writes the refresh token as an httpOnly cookie (never in the body) and
 * returns what the portal keeps in memory: the short-lived access token.
 */
function respondWithSession(res: Response, session: VendorSession, secure: boolean) {
  res.cookie(VENDOR_REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true, secure, sameSite: 'strict', path: VENDOR_REFRESH_COOKIE_PATH, expires: session.refreshExpiresAt,
  });
  return { accessToken: session.accessToken, expiresIn: session.expiresIn, vendor: session.vendor };
}

// ---------------------------------------------------------------------------
// Vendor portal authentication. @Public() only bypasses the *merchant*
// JwtAuthGuard — these endpoints never set or read `request.user`.
// The store for login / forgot-password comes from X-Store-Id (validated by
// StoreContextMiddleware); after login the store comes only from the token.
// ---------------------------------------------------------------------------
@ApiTags('Vendor portal — auth')
@Public()
@Controller('vendor/auth')
export class VendorAuthController {
  private readonly secureCookie: boolean;

  constructor(private readonly auth: VendorAuthService, config: ConfigService) {
    this.secureCookie = config.get<string>('NODE_ENV') === 'production' || config.get<string>('NODE_ENV') === 'staging';
  }

  @Post('accept-invite')
  @Throttle(STRICT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a password from an invitation link and sign in' })
  async acceptInvite(@Body() dto: VendorAcceptInviteDto, @Res({ passthrough: true }) res: Response) {
    return respondWithSession(res, await this.auth.acceptInvitation(dto.token, dto.password), this.secureCookie);
  }

  @Post('login')
  @Throttle(STRICT)
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request & { storeId?: string }, @Body() dto: VendorLoginDto, @Res({ passthrough: true }) res: Response) {
    return respondWithSession(res, await this.auth.login(req.storeId, dto.email, dto.password), this.secureCookie);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh cookie and issue a new access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return respondWithSession(res, await this.auth.refresh(req.cookies?.[VENDOR_REFRESH_COOKIE]), this.secureCookie);
    } catch (err) {
      res.clearCookie(VENDOR_REFRESH_COOKIE, { path: VENDOR_REFRESH_COOKIE_PATH });
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[VENDOR_REFRESH_COOKIE]);
    res.clearCookie(VENDOR_REFRESH_COOKIE, { path: VENDOR_REFRESH_COOKIE_PATH });
    return { message: 'Signed out' };
  }

  @Post('forgot-password')
  @Throttle(STRICT)
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Req() req: Request & { storeId?: string }, @Body() dto: VendorForgotPasswordDto) {
    await this.auth.forgotPassword(req.storeId, dto.email);
    return { message: 'If that email belongs to an active vendor account, a reset link is on its way.' };
  }

  @Post('reset-password')
  @Throttle(STRICT)
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: VendorResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { message: 'Password updated. Sign in with your new password.' };
  }
}

// ---------------------------------------------------------------------------
// The signed-in vendor's own account. Class-level VendorJwtAuthGuard: every
// route here requires a valid, current vendor token.
// ---------------------------------------------------------------------------
@ApiTags('Vendor portal — account')
@ApiBearerAuth()
@Public()
@UseGuards(VendorJwtAuthGuard)
@Controller('vendor/me')
export class VendorAccountController {
  private readonly secureCookie: boolean;

  constructor(private readonly auth: VendorAuthService, config: ConfigService) {
    this.secureCookie = config.get<string>('NODE_ENV') === 'production' || config.get<string>('NODE_ENV') === 'staging';
  }

  @Get()
  me(@CurrentVendor() vendor: AuthenticatedVendor) {
    return this.auth.profile(vendor.vendorUserId);
  }

  @Patch()
  update(@CurrentVendor() vendor: AuthenticatedVendor, @Body() dto: VendorUpdateProfileDto) {
    return this.auth.updateProfile(vendor, dto.name);
  }

  @Post('password')
  @Throttle(STRICT)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentVendor() vendor: AuthenticatedVendor, @Body() dto: VendorChangePasswordDto, @Res({ passthrough: true }) res: Response,
  ) {
    return respondWithSession(res, await this.auth.changePassword(vendor, dto.currentPassword, dto.newPassword), this.secureCookie);
  }
}
