import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useResetPassword, authErrorMessage } from '@/hooks/useCustomerAuth';
import {
  AuthLayout, AuthField, AuthErrorBanner, AuthSubmitButton, SERIF,
} from '@/components/auth/AuthLayout';

const AurusResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [matchError, setMatchError] = useState<string | null>(null);
  const resetPassword = useResetPassword();

  if (!token) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-[20px] font-bold text-gray-900 mb-2" style={SERIF}>Invalid link</h1>
          <p className="text-[13px] text-gray-500 mb-6">
            This password reset link is missing its token. Please request a new one.
          </p>
          <Link to="/forgot-password" className="text-[13px] text-purple-700 font-semibold hover:underline">
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (resetPassword.isSuccess) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-[20px] font-bold text-gray-900 mb-2" style={SERIF}>Password reset</h1>
          <p className="text-[13px] text-gray-500 mb-6">
            Your password has been changed and all previous sessions have been signed out.
          </p>
          <Link to="/login" className="text-[13px] text-purple-700 font-semibold hover:underline">
            Log in with your new password
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMatchError(null);

    if (newPassword !== confirmPassword) {
      setMatchError('Passwords do not match.');
      return;
    }

    resetPassword.mutate({ token, newPassword });
  };

  return (
    <AuthLayout>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1" style={SERIF}>Set a new password</h1>
      <p className="text-[13px] text-gray-500 mb-6">Choose a new password for your account.</p>

      {matchError && <AuthErrorBanner message={matchError} />}
      {resetPassword.isError && (
        <AuthErrorBanner message={authErrorMessage(resetPassword.error, 'This link is invalid or has expired.')} />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label="New Password"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          helperText="At least 8 characters, with an uppercase letter, a lowercase letter, and a number."
        />
        <AuthField
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />
        <AuthSubmitButton label="Reset Password" loadingLabel="Resetting…" isLoading={resetPassword.isPending} />
      </form>
    </AuthLayout>
  );
};

export default AurusResetPassword;
