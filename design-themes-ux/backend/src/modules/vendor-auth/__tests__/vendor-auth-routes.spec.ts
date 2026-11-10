import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { VendorAccountController, VendorAuthController } from '../vendor-auth.controller';
import { VendorUsersController } from '../vendor-users.controller';
import { VendorJwtAuthGuard } from '../guards/vendor-jwt-auth.guard';
import { InviteVendorUserDto, SetVendorUserStatusDto, VendorUpdateProfileDto } from '../dto/vendor-auth.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const handlers = (C: any) => Object.getOwnPropertyNames(C.prototype).filter((m) => m !== 'constructor');

describe('vendor auth route wiring', () => {
  it('every /vendor/me route requires the vendor guard (class level), so none can be left open', () => {
    expect(Reflect.getMetadata('__guards__', VendorAccountController)).toEqual([VendorJwtAuthGuard]);
    expect(handlers(VendorAccountController).sort()).toEqual(['changePassword', 'me', 'update']);
  });

  it('vendor routes are @Public only towards the merchant JwtAuthGuard and carry no merchant permissions', () => {
    for (const C of [VendorAuthController, VendorAccountController]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, C)).toBe(true);
      for (const h of handlers(C)) expect(Reflect.getMetadata('permissions', C.prototype[h])).toBeUndefined();
    }
  });

  it('the owner account-management routes are NOT public', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, VendorUsersController)).toBeUndefined();
    for (const h of handlers(VendorUsersController)) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, VendorUsersController.prototype[h as keyof VendorUsersController])).toBeUndefined();
    }
  });
});

describe('owner-only vendor account management (real PermissionsGuard)', () => {
  const guard = new PermissionsGuard(new Reflector());
  const can = (h: string, role: string) => {
    try {
      return guard.canActivate({
        getHandler: () => (VendorUsersController.prototype as any)[h], getClass: () => VendorUsersController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      } as any);
    } catch (e) { if (e instanceof ForbiddenException) return false; throw e; }
  };

  it.each([
    //  role            list   invite/resend/reset/status
    ['SUPER_ADMIN',     true,  true],
    ['STORE_OWNER',     true,  true],
    ['STORE_MANAGER',   true,  false],
    ['STORE_STAFF',     false, false],
    ['CUSTOMER',        false, false],
  ])('%s: list=%s manage=%s', (role, list, manage) => {
    expect(can('list', role)).toBe(list);
    for (const h of ['invite', 'resendInvitation', 'sendPasswordReset', 'setStatus']) expect([h, can(h, role)]).toEqual([h, manage]);
  });
});

describe('vendor DTOs cannot carry privileged fields', () => {
  const strip = async (cls: any, body: Record<string, unknown>) => {
    const dto = plainToInstance(cls, body) as object;
    const errors = await validate(dto, { whitelist: true });
    return { dto: dto as Record<string, unknown>, errors: errors.map((e) => e.property) };
  };

  it('profile update keeps only the name', async () => {
    const { dto, errors } = await strip(VendorUpdateProfileDto, { name: ' Asha ', vendorId: 'v2', storeId: 's2', status: 'ACTIVE', email: 'x@y.z' });
    expect(errors).toEqual([]);
    expect(dto).toEqual({ name: 'Asha' });
  });

  it('invitations accept only email and name', async () => {
    const { dto } = await strip(InviteVendorUserDto, { email: ' A@B.Co ', name: 'A', vendorId: 'v2', storeId: 's2', status: 'ACTIVE' });
    expect(dto).toEqual({ email: 'a@b.co', name: 'A' });
  });

  it('status changes are limited to ACTIVE / SUSPENDED / REVOKED', async () => {
    expect((await strip(SetVendorUserStatusDto, { status: 'INVITED' })).errors).toContain('status');
    expect((await strip(SetVendorUserStatusDto, { status: 'SUSPENDED' })).errors).toEqual([]);
  });
});
