import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { DocumentController } from './document.controller';
import { FeatureFlagController } from './feature-flag.controller';

// Runs the real PermissionsGuard against the real @Permissions metadata of the
// theme content routes, for every role.

const guard = new PermissionsGuard(new Reflector());

function allowed(controller: any, handler: string, role: string): boolean {
  const ctx = {
    getHandler:   () => controller.prototype[handler],
    getClass:     () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  } as any;
  try { return guard.canActivate(ctx); } catch (e) { if (e instanceof ForbiddenException) return false; throw e; }
}

const READ    = [[DocumentController, 'getDocument'], [DocumentController, 'listVersions'], [DocumentController, 'shadowCheck'],
                 [FeatureFlagController, 'getAll'], [FeatureFlagController, 'getAudit'], [FeatureFlagController, 'getKnown']] as const;
const EDIT    = [[DocumentController, 'saveDraft'], [DocumentController, 'discardDraft']] as const;
const PUBLISH = [[DocumentController, 'publish'], [DocumentController, 'rollback'],
                 [FeatureFlagController, 'enable'], [FeatureFlagController, 'disable']] as const;

describe('Theme content route permissions (S2)', () => {
  it.each([
    //  role            read   edit   publish/rollback/flags
    ['SUPER_ADMIN',     true,  true,  true],
    ['STORE_OWNER',     true,  true,  true],
    ['STORE_MANAGER',   true,  true,  false],
    ['STORE_STAFF',     false, false, false],
    ['CUSTOMER',        false, false, false],
  ])('%s: read=%s edit=%s publish=%s', (role, read, edit, publish) => {
    for (const [c, h] of READ)    expect([h, allowed(c, h, role)]).toEqual([h, read]);
    for (const [c, h] of EDIT)    expect([h, allowed(c, h, role)]).toEqual([h, edit]);
    for (const [c, h] of PUBLISH) expect([h, allowed(c, h, role)]).toEqual([h, publish]);
  });

  it('every store-scoped content handler declares a permission', () => {
    for (const [c, h] of [...READ, ...EDIT, ...PUBLISH]) {
      expect([h, Reflect.getMetadata('permissions', (c as any).prototype[h])?.[0]]).toEqual([h, expect.stringMatching(/^theme:/)]);
    }
  });

  it('flag toggles record the authenticated user as actor, ignoring any client-supplied actorId', async () => {
    const flags = { validateFlag: jest.fn(), enable: jest.fn(), disable: jest.fn() } as any;
    const ctrl = new FeatureFlagController(flags);
    const user = { id: 'owner-1', role: 'STORE_OWNER', storeId: 's1' };

    const res = await (ctrl.enable as any)('s1', 'SOME_FLAG', user);
    expect(flags.enable).toHaveBeenCalledWith('s1', 'SOME_FLAG', 'owner-1');
    expect(res.actorId).toBe('owner-1');
    await (ctrl.disable as any)('s1', 'SOME_FLAG', user);
    expect(flags.disable).toHaveBeenCalledWith('s1', 'SOME_FLAG', 'owner-1');
  });

  it('GET /content/flags/known is declared before /:storeId so it is reachable', () => {
    const order = Object.getOwnPropertyNames(FeatureFlagController.prototype);
    expect(order.indexOf('getKnown')).toBeLessThan(order.indexOf('getAll'));
  });
});

describe('content controllers rely on the global guard chain', () => {
  // A controller-level JwtAuthGuard re-runs passport after StoreContextGuard and
  // replaces the store-scoped principal (membership store + role) — which made
  // invited managers fail the controllers' own store check.
  it.each([['DocumentController', DocumentController], ['FeatureFlagController', FeatureFlagController]])(
    '%s declares no controller-level guards', (_n, C) => {
      expect(Reflect.getMetadata('__guards__', C)).toBeUndefined();
    },
  );
});
