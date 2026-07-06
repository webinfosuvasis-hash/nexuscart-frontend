import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/CustomerAuthContext';

export const AuthLoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F5F3FA]">
    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
  </div>
);

/**
 * Wraps routes that require a logged-in customer. Redirects to /login,
 * preserving the intended destination in the `redirect` query param so the
 * login page can send the customer back where they meant to go.
 */
export const ProtectedRoute: React.FC = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'bootstrapping') return <AuthLoadingScreen />;

  if (status === 'unauthenticated') {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
};

/**
 * Wraps routes (login/register/forgot-password) that a logged-in customer
 * shouldn't see — sends them to their intended destination (or home)
 * instead of re-showing an auth form.
 */
export const GuestOnlyRoute: React.FC = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'bootstrapping') return <AuthLoadingScreen />;

  if (status === 'authenticated') {
    const redirect = new URLSearchParams(location.search).get('redirect') || '/';
    return <Navigate to={redirect} replace />;
  }

  return <Outlet />;
};
