import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/CustomerAuthContext';
import { CustomerAuthApiError } from '@/lib/customerAuthApi';
import { authPath, safeRedirect } from '@/lib/authRedirect';
import {
  AuthLayout, AuthField, AuthErrorBanner, AuthSubmitButton, GuestCheckoutReturn, SERIF,
} from '@/components/auth/AuthLayout';

const AurusLogin: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'));
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(
        err instanceof CustomerAuthApiError
          ? err.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1" style={SERIF}>Welcome back</h1>
      <p className="text-[13px] text-gray-500 mb-6">Log in to your Aurus account</p>

      <GuestCheckoutReturn redirect={redirect} />

      {error && <AuthErrorBanner message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="priya@example.com"
          autoComplete="email"
          required
        />
        <AuthField
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-[12px] text-purple-700 hover:underline font-medium">
            Forgot password?
          </Link>
        </div>

        <AuthSubmitButton label="Log In" loadingLabel="Logging in…" isLoading={isSubmitting} />
      </form>

      <p className="text-[12.5px] text-gray-500 text-center mt-6">
        New to Aurus?{' '}
        <Link to={authPath('/register', redirect)} className="text-purple-700 font-semibold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
};

export default AurusLogin;
