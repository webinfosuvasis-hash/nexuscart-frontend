import React from 'react';
import { Link } from 'react-router-dom';

export const UI = { fontFamily: 'system-ui, -apple-system, sans-serif' };
export const SERIF = { fontFamily: "'Cormorant Garamond', Georgia, serif" };

/**
 * Shared chrome for the auth funnel (login/register/forgot/reset/verify) —
 * a minimal top bar + centered card, mirroring how AurusCheckout trims the
 * full AurusHeader down to just a back-link and brand mark for focused
 * single-purpose pages.
 */
export const AuthLayout: React.FC<{ children: React.ReactNode; maxWidth?: number }> = ({
  children,
  maxWidth = 420,
}) => (
  <div className="min-h-screen bg-[#F5F3FA] flex flex-col" style={UI}>
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-[1280px] mx-auto px-6 h-[54px] flex items-center justify-center">
        <Link to="/" className="text-[19px] font-bold tracking-[0.14em] text-gray-900 hover:text-purple-700 transition-colors" style={SERIF}>
          AURUS
        </Link>
      </div>
    </header>

    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full bg-white rounded-2xl shadow-sm p-8" style={{ maxWidth }}>
        {children}
      </div>
    </div>
  </div>
);

export const AuthField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  helperText?: string;
}> = ({
  label, value, onChange, type = 'text', placeholder, autoComplete, required, helperText,
}) => (
  <div>
    <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide block mb-1.5" style={UI}>
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all"
      style={UI}
    />
    {helperText && <p className="text-[11px] text-gray-400 mt-1">{helperText}</p>}
  </div>
);

export const AuthErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-red-50 border border-red-200 text-red-700 text-[12.5px] rounded-lg px-4 py-3 mb-5" role="alert">
    {message}
  </div>
);

export const AuthSubmitButton: React.FC<{
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
}> = ({
  label, loadingLabel = 'Please wait…', isLoading, disabled,
}) => (
  <button
    type="submit"
    disabled={isLoading || disabled}
    className="w-full py-3 text-white text-[13px] font-black tracking-[0.08em] uppercase rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
    style={{ background: 'linear-gradient(90deg,#9333EA,#7B22F9)', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}
  >
    {isLoading ? loadingLabel : label}
  </button>
);
