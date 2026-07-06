import { useMutation } from '@tanstack/react-query';
import * as api from '@/lib/customerAuthApi';

function messageOf(err: unknown, fallback: string): string {
  return err instanceof api.CustomerAuthApiError ? err.message : fallback;
}

/**
 * Standalone auth actions that don't touch the logged-in session
 * (CustomerAuthContext owns login/register/logout/logoutAll instead, since
 * those mutate global auth state). These are plain react-query mutations —
 * same shape as useCart.ts's mutation hooks — so pages get loading/error
 * state for free.
 */

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.forgotPassword(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      api.resetPassword(token, newPassword),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => api.verifyEmail(token),
  });
}

export { messageOf as authErrorMessage };
