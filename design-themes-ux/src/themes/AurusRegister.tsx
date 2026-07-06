import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/CustomerAuthContext';
import { CustomerAuthApiError } from '@/lib/customerAuthApi';
import {
  AuthLayout, AuthField, AuthErrorBanner, AuthSubmitButton, SERIF,
} from '@/components/auth/AuthLayout';

const AurusRegister: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side only: confirming the two fields match. The password's own
    // strength rules are enforced by the backend — not duplicated here.
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ name, email, password, phone: phone || undefined });
      toast.success('Welcome to Aurus! Check your email to verify your account.');
      const redirect = searchParams.get('redirect') || '/';
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
    <AuthLayout maxWidth={460}>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1" style={SERIF}>Create your account</h1>
      <p className="text-[13px] text-gray-500 mb-6">Join Aurus for a faster, personalised checkout</p>

      {error && <AuthErrorBanner message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label="Full Name"
          value={name}
          onChange={setName}
          placeholder="Priya Sharma"
          autoComplete="name"
          required
        />
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
          label="Phone (optional)"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="9876543210"
          autoComplete="tel"
        />
        <AuthField
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          helperText="At least 8 characters, with an uppercase letter, a lowercase letter, and a number."
        />
        <AuthField
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />

        <AuthSubmitButton label="Create Account" loadingLabel="Creating account…" isLoading={isSubmitting} />
      </form>

      <p className="text-[12.5px] text-gray-500 text-center mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-purple-700 font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
};

export default AurusRegister;
