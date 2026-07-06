import React, {
  createContext, useContext, useCallback, useEffect, useMemo, useState,
} from 'react';
import * as api from '@/lib/customerAuthApi';

type AuthStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';

interface CustomerAuthContextValue {
  customer: api.AuthenticatedCustomer | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (input: api.LoginInput) => Promise<void>;
  register: (input: api.RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

export const CustomerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customer, setCustomer] = useState<api.AuthenticatedCustomer | null>(null);
  const [status, setStatus] = useState<AuthStatus>('bootstrapping');

  // Silent session restore on first mount — the access token lives only in
  // memory, so a full page reload always starts here.
  useEffect(() => {
    let cancelled = false;
    api.bootstrapSession().then((restored) => {
      if (cancelled) return;
      setCustomer(restored);
      setStatus(restored ? 'authenticated' : 'unauthenticated');
    });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (input: api.LoginInput) => {
    const pair = await api.login(input);
    api.applyTokenPair(pair);
    const me = await api.getMe();
    setCustomer(me);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (input: api.RegisterInput) => {
    const pair = await api.register(input);
    api.applyTokenPair(pair);
    const me = await api.getMe();
    setCustomer(me);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Best-effort — even if the server call fails (already-expired token,
      // network drop), the client must still forget this session.
    }
    api.clearTokens();
    setCustomer(null);
    setStatus('unauthenticated');
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await api.logoutAll();
    } catch {
      // Best-effort, same reasoning as logout().
    }
    api.clearTokens();
    setCustomer(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<CustomerAuthContextValue>(() => ({
    customer,
    status,
    isAuthenticated: status === 'authenticated',
    login,
    register,
    logout,
    logoutAll,
  }), [customer, status, login, register, logout, logoutAll]);

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useAuth = (): CustomerAuthContextValue => {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useAuth must be used within CustomerAuthProvider');
  return ctx;
};
