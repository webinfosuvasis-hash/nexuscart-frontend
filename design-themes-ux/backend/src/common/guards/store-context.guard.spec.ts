import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StoreContextGuard, RequireStore } from './store-context.guard';

const STORE_A = 'store_a';
const STORE_B = 'store_b';

function setup(membership: { role: string } | null = null) {
  const prisma = { storeStaff: { findUnique: jest.fn().mockResolvedValue(membership) } } as any;
  const guard = new StoreContextGuard(new Reflector(), prisma);
  const run = (request: any, handler: any = () => undefined) =>
    guard.canActivate({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler:   () => handler,
      getClass:     () => class {},
    } as any);
  return { prisma, run };
}

describe('StoreContextGuard — tenant isolation', () => {
  it('lets an owner use their own store via the header', async () => {
    const { run, prisma } = setup();
    const req = { storeId: STORE_A, user: { id: 'u1', role: 'STORE_OWNER', storeId: STORE_A } };
    await expect(run(req)).resolves.toBe(true);
    expect(prisma.storeStaff.findUnique).not.toHaveBeenCalled();
    expect(req.user.role).toBe('STORE_OWNER');
  });

  it('rejects an owner sending another store\'s id', async () => {
    const { run } = setup(null);
    const req = { storeId: STORE_B, user: { id: 'u1', role: 'STORE_OWNER', storeId: STORE_A } };
    await expect(run(req)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a user with no store sending any store id (previously allowed)', async () => {
    const { run } = setup(null);
    const req = { storeId: STORE_B, user: { id: 'u2', role: 'STORE_STAFF', storeId: null } };
    await expect(run(req)).rejects.toThrow('Access denied for this store');
  });

  it('allows a StoreStaff member and scopes the principal to that store and membership role', async () => {
    const { run, prisma } = setup({ role: 'STAFF' });
    const req: any = { storeId: STORE_B, user: { id: 'u3', role: 'STORE_STAFF', storeId: null } };
    await expect(run(req)).resolves.toBe(true);
    expect(prisma.storeStaff.findUnique).toHaveBeenCalledWith({
      where: { storeId_userId: { storeId: STORE_B, userId: 'u3' } }, select: { role: true },
    });
    expect(req.user).toEqual(expect.objectContaining({ storeId: STORE_B, role: 'STORE_STAFF' }));
  });

  it('downgrades an owner of another store to the role their membership grants here', async () => {
    const { run } = setup({ role: 'STAFF' });
    const req: any = { storeId: STORE_B, user: { id: 'u1', role: 'STORE_OWNER', storeId: STORE_A } };
    await run(req);
    expect(req.user.role).toBe('STORE_STAFF');
    expect(req.user.storeId).toBe(STORE_B);
  });

  it.each([['MANAGER', 'STORE_MANAGER'], ['OWNER', 'STORE_OWNER'], ['something-else', 'STORE_STAFF']])(
    'membership role %s → %s', async (membershipRole, expected) => {
      const { run } = setup({ role: membershipRole });
      const req: any = { storeId: STORE_B, user: { id: 'u4', role: 'STORE_MANAGER', storeId: null } };
      await run(req);
      expect(req.user.role).toBe(expected);
    },
  );

  it('SUPER_ADMIN may act on any store', async () => {
    const { run, prisma } = setup(null);
    await expect(run({ storeId: STORE_B, user: { id: 'sa', role: 'SUPER_ADMIN', storeId: null } })).resolves.toBe(true);
    expect(prisma.storeStaff.findUnique).not.toHaveBeenCalled();
  });

  it('does nothing on public / customer routes (no merchant user) or without a header', async () => {
    const { run, prisma } = setup(null);
    await expect(run({ storeId: STORE_B })).resolves.toBe(true);
    await expect(run({ storeId: STORE_B, customer: { id: 'c1' } })).resolves.toBe(true);
    await expect(run({ user: { id: 'u1', role: 'STORE_OWNER', storeId: STORE_A } })).resolves.toBe(true);
    expect(prisma.storeStaff.findUnique).not.toHaveBeenCalled();
  });

  it('still enforces @RequireStore() when the header is missing', async () => {
    class C { @RequireStore() h() { return undefined; } }
    const { run } = setup(null);
    await expect(run({ user: { id: 'u1', role: 'STORE_OWNER', storeId: STORE_A } }, C.prototype.h))
      .rejects.toThrow('X-Store-Id header is required');
  });
});
