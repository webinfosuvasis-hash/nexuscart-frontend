import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/cartApi';

export const CART_QUERY_KEY = ['cart'] as const;

// ─── Query ────────────────────────────────────────────────────────────────────

export function useCart() {
  return useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn:  api.getCart,
    staleTime: 30_000,
    gcTime:    300_000,
    retry: (count, err) => {
      if (err instanceof api.CartApiError && [404, 409, 423].includes(err.status)) return false;
      return count < 2;
    },
  });
}

export function useCartActivity() {
  return useQuery({
    queryKey: ['cart-activity'],
    queryFn:  api.getCartActivity,
    staleTime: 60_000,
    gcTime:    300_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.addToCart,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY });
    },
    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart);
    },
    onError: (err) => {
      const msg = err instanceof api.CartApiError
        ? err.message
        : 'Could not add item to cart';
      toast.error(msg);
      qc.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      api.updateCartItem(itemId, quantity),

    onMutate: async ({ itemId, quantity }) => {
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY });
      const prev = qc.getQueryData<api.Cart>(CART_QUERY_KEY);
      if (prev) {
        const target = prev.items.find((i) => i.id === itemId);
        const oldLineTotal = target?.lineTotal ?? 0;
        // Preserve per-unit lineDiscount when scaling quantity
        const perUnitDiscount = target ? target.lineDiscount / target.quantity : 0;
        const newLineTotal = target
          ? target.unitPrice * quantity - perUnitDiscount * quantity
          : 0;
        const totalsDelta = newLineTotal - oldLineTotal;
        qc.setQueryData<api.Cart>(CART_QUERY_KEY, {
          ...prev,
          items: prev.items.map((i) =>
            i.id === itemId
              ? { ...i, quantity, lineTotal: newLineTotal, lineDiscount: perUnitDiscount * quantity }
              : i,
          ),
          itemCount: prev.itemCount - (target?.quantity ?? 0) + quantity,
          totals: {
            ...prev.totals,
            subtotal:   prev.totals.subtotal   + totalsDelta,
            grandTotal: prev.totals.grandTotal + totalsDelta,
          },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(CART_QUERY_KEY, ctx.prev);
      toast.error('Failed to update quantity');
    },
    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart);
    },
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.removeCartItem,

    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY });
      const prev = qc.getQueryData<api.Cart>(CART_QUERY_KEY);
      if (prev) {
        const removed = prev.items.find((i) => i.id === itemId);
        const removedLineTotal = removed?.lineTotal ?? 0;
        qc.setQueryData<api.Cart>(CART_QUERY_KEY, {
          ...prev,
          items:           prev.items.filter((i) => i.id !== itemId),
          itemCount:       Math.max(0, prev.itemCount - (removed?.quantity ?? 1)),
          uniqueItemCount: Math.max(0, prev.uniqueItemCount - 1),
          totals: {
            ...prev.totals,
            subtotal:   Math.max(0, prev.totals.subtotal   - removedLineTotal),
            grandTotal: Math.max(0, prev.totals.grandTotal - removedLineTotal),
          },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(CART_QUERY_KEY, ctx.prev);
      toast.error('Failed to remove item');
    },
    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart);
    },
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.clearCart,
    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart);
    },
    onError: () => toast.error('Failed to clear cart'),
  });
}

export function useApplyPromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.applyPromotion,
    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart);
      toast.success('Promotion applied');
    },
    onError: (err) => {
      const msg = err instanceof api.CartApiError ? err.message : 'Invalid promotion code';
      toast.error(msg);
    },
  });
}

export function useRemovePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.removePromotion,
    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart);
      toast.success('Promotion removed');
    },
    onError: () => toast.error('Failed to remove promotion'),
  });
}
