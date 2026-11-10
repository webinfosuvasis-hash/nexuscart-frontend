import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { PERMISSIONS_KEY } from '@/common/decorators/permissions.decorator';
import { VendorsController } from '../vendors.controller';
import { VendorNotificationsController } from '../vendor-notifications.controller';

// Reads the real @Permissions metadata off VendorsController and runs the
// real PermissionsGuard against it for each role.

const guard = new PermissionsGuard(new Reflector());

function canCall(handler: string, role: string | null, controller: any = VendorsController): boolean {
  const fn = controller.prototype[handler];
  const ctx = {
    getHandler:   () => fn,
    getClass:     () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  } as any;
  try {
    return guard.canActivate(ctx);
  } catch (err) {
    if (err instanceof ForbiddenException) return false;
    throw err;
  }
}

describe('Vendor endpoint permissions', () => {
  it('every handler declares a vendors:* permission', () => {
    for (const h of ['findAll', 'findOne', 'create', 'update', 'remove'] as const) {
      const perms = Reflect.getMetadata(PERMISSIONS_KEY, VendorsController.prototype[h]);
      expect(perms?.[0]).toMatch(/^vendors:/);
    }
  });

  it.each([
    //  role            read   write
    ['SUPER_ADMIN',     true,  true],
    ['STORE_OWNER',     true,  true],
    ['STORE_MANAGER',   true,  false],
    ['STORE_STAFF',     false, false],
    ['CUSTOMER',        false, false],
  ])('%s: read=%s write=%s', (role, read, write) => {
    expect(canCall('findAll', role)).toBe(read);
    expect(canCall('findOne', role)).toBe(read);
    expect(canCall('create', role)).toBe(write);
    expect(canCall('update', role)).toBe(write);
    expect(canCall('remove', role)).toBe(write);
  });

  it('unauthenticated requests are refused', () => {
    expect(canCall('findAll', null)).toBe(false);
  });

  it.each([
    ['SUPER_ADMIN',   true,  true],
    ['STORE_OWNER',   true,  true],
    ['STORE_MANAGER', true,  false], // can see delivery status, cannot trigger a resend
    ['STORE_STAFF',   false, false],
    ['CUSTOMER',      false, false],
  ])('vendor-notifications %s: list=%s resend=%s', (role, list, resend) => {
    expect(canCall('list', role, VendorNotificationsController)).toBe(list);
    expect(canCall('resend', role, VendorNotificationsController)).toBe(resend);
  });
});
