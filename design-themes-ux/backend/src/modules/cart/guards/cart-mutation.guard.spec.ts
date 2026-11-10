import { ConflictException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CartStatus } from '@prisma/client';
import { CartMutationGuard } from './cart-mutation.guard';

const ctxFor = (req: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

describe('CartMutationGuard', () => {
  const findFirst = jest.fn();
  const update = jest.fn();
  const guard = new CartMutationGuard({ cart: { findFirst, update } } as never);

  beforeEach(() => { findFirst.mockReset(); update.mockReset(); });

  it('looks only at the session’s live (ACTIVE / LOCKED) cart, newest first', async () => {
    findFirst.mockResolvedValue(null);
    await guard.canActivate(ctxFor({ storeId: 's1', cartSessionId: 'sess' }));
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { storeId: 's1', sessionId: 'sess', status: { in: [CartStatus.ACTIVE, CartStatus.LOCKED] } },
      orderBy: { createdAt: 'desc' },
    }));
  });

  it('lets the shopper keep shopping after an order converted their previous cart', async () => {
    // Only a CONVERTED (or MERGED) cart exists for the session → no live cart is found.
    findFirst.mockResolvedValue(null);
    const req: Record<string, unknown> = { storeId: 's1', cartSessionId: 'sess' };
    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
    expect(req.resolvedCart).toBeNull();
  });

  it('allows an ACTIVE cart', async () => {
    findFirst.mockResolvedValue({ id: 'c1', status: CartStatus.ACTIVE, lockedUntil: null });
    await expect(guard.canActivate(ctxFor({ storeId: 's1', cartSessionId: 'sess' }))).resolves.toBe(true);
  });

  it('still blocks a cart locked by an in-progress checkout', async () => {
    findFirst.mockResolvedValue({ id: 'c1', status: CartStatus.LOCKED, lockedUntil: new Date(Date.now() + 60_000) });
    await expect(guard.canActivate(ctxFor({ storeId: 's1', cartSessionId: 'sess' }))).rejects.toBeInstanceOf(ConflictException);
  });

  it('auto-unlocks an expired lock', async () => {
    findFirst.mockResolvedValue({ id: 'c1', status: CartStatus.LOCKED, lockedUntil: new Date(Date.now() - 1000) });
    await expect(guard.canActivate(ctxFor({ storeId: 's1', cartSessionId: 'sess' }))).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CartStatus.ACTIVE }) }));
  });

  it('rejects a request without a cart session', async () => {
    await expect(guard.canActivate(ctxFor({ storeId: 's1' }))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
