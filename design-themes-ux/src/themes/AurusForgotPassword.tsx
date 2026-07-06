import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useForgotPassword, authErrorMessage } from '@/hooks/useCustomerAuth';
import {
  AuthLayout, AuthField, AuthErrorBanner, AuthSubmitButton, SERIF,
} from '@/components/auth/AuthLayout';

const AurusForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const forgotPassword = useForgotPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    forgotPassword.mutate(email);
  };

  if (forgotPassword.isSuccess) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-8 h-8 text-purple-600" />
          </div>
          <h1 className="text-[20px] font-bold text-gray-900 mb-2" style={SERIF}>Check your email</h1>
          <p className="text-[13px] text-gray-500 mb-6">
            If an account exists for <span className="font-semibold text-gray-700">{email}</span>,
            we&apos;ve sent a link to reset your password.
          </p>
          <Link to="/login" className="text-[13px] text-purple-700 font-semibold hover:underline">
            Back to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1" style={SERIF}>Forgot password?</h1>
      <p className="text-[13px] text-gray-500 mb-6">
        Enter the email on your account and we&apos;ll send you a reset link.
      </p>

      {forgotPassword.isError && (
        <AuthErrorBanner message={authErrorMessage(forgotPassword.error, 'Something went wrong. Please try again.')} />
      )}

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
        <AuthSubmitButton label="Send Reset Link" loadingLabel="Sending…" isLoading={forgotPassword.isPending} />
      </form>

      <p className="text-[12.5px] text-gray-500 text-center mt-6">
        <Link to="/login" className="text-purple-700 font-semibold hover:underline">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
};

export default AurusForgotPassword;
