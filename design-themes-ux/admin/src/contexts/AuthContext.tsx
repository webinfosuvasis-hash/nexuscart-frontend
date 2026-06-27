import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  storeId?: string | null;
  // kept for Sidebar backward-compat (uses user.user_metadata?.name)
  user_metadata: { name: string };
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('store_id');
}

function buildUser(raw: any): AppUser {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role,
    storeId: raw.storeId ?? null,
    user_metadata: { name: raw.name },
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from stored token via /auth/me
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { setLoading(false); return; }

    api.get('/auth/me')
      .then((data: any) => {
        const u = buildUser(data);
        if (u.storeId) localStorage.setItem('store_id', u.storeId);
        setUser(u);
      })
      .catch(() => clearTokens())
      .finally(() => setLoading(false));

    // Listen for 401 → force logout
    const handle = () => { clearTokens(); setUser(null); };
    window.addEventListener('auth:logout', handle);
    return () => window.removeEventListener('auth:logout', handle);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const data: any = await api.post('/auth/login', { email, password });
      saveTokens(data.data.accessToken, data.data.refreshToken);
      const u = buildUser(data.data.user);
      if (u.storeId) localStorage.setItem('store_id', u.storeId);
      setUser(u);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message ?? 'Login failed' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try {
      const data: any = await api.post('/auth/register', { email, password, name });
      saveTokens(data.data.accessToken, data.data.refreshToken);
      // After register, fetch user profile to get storeId
      const me: any = await api.get('/auth/me');
      const u = buildUser(me.data ?? me);
      if (u.storeId) localStorage.setItem('store_id', u.storeId);
      setUser(u);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message ?? 'Registration failed' };
    }
  }, []);

  const signOut = useCallback(async () => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
