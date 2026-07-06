import React, { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useVerifyEmail, authErrorMessage } from '@/hooks/useCustomerAuth';
import { AuthLayout, SERIF } from '@/components/auth/AuthLayout';

const AurusVerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const verifyEmail = useVerifyEmail();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!token || hasRun.current) return;
    hasRun.current = true;
    verifyEmail.mutate(token);
    // verifyEmail is a fresh useMutation object every render — only re-run this effect if the token itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-[20px] font-bold text-gray-900 mb-2" style={SERIF}>Invalid link</h1>
          <p className="text-[13px] text-gray-500 mb-6">
            This verification link is missing its token.
          </p>
          <Link to="/" className="text-[13px] text-purple-700 font-semibold hover:underline">
            Back to home
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (verifyEmail.isSuccess) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-[20px] font-bold text-gray-900 mb-2" style={SERIF}>Email verified</h1>
          <p className="text-[13px] text-gray-500 mb-6">Your email address has been confirmed.</p>
          <Link to="/login" className="text-[13px] text-purple-700 font-semibold hover:underline">
            Continue to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (verifyEmail.isError) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-[20px] font-bold text-gray-900 mb-2" style={SERIF}>Verification failed</h1>
          <p className="text-[13px] text-gray-500 mb-6">
            {authErrorMessage(verifyEmail.error, 'This link is invalid or has expired.')}
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
      <div className="text-center py-6">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
        <p className="text-[13px] text-gray-500">Verifying your email…</p>
      </div>
    </AuthLayout>
  );
};

export default AurusVerifyEmail;
