import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LogOut, ShieldOff, Loader2, Pencil, BadgeCheck, BadgeAlert, MapPin, Package, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/CustomerAuthContext';
import { useProfile, useUpdateProfile } from '@/hooks/useCustomerProfile';
import { CustomerAuthApiError } from '@/lib/customerProfileApi';
import {
  AuthLayout, AuthField, AuthErrorBanner, SERIF,
} from '@/components/auth/AuthLayout';

/**
 * Account landing page — profile view/edit + session controls.
 */
const AurusAccount: React.FC = () => {
  const { isAuthenticated, logout, logoutAll } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<'logout' | 'logout-all' | null>(null);

  const { data: profile, isLoading: isProfileLoading } = useProfile(isAuthenticated);
  const updateProfile = useUpdateProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Seed the form whenever we (re-)enter edit mode or fresh profile data arrives.
  useEffect(() => {
    if (profile && !isEditing) {
      setName(profile.name);
      setPhone(profile.phone ?? '');
    }
  }, [profile, isEditing]);

  const startEditing = () => {
    if (profile) {
      setName(profile.name);
      setPhone(profile.phone ?? '');
    }
    setValidationError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setValidationError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('Name cannot be empty.');
      return;
    }

    try {
      await updateProfile.mutateAsync({ name: name.trim(), phone: phone.trim() || undefined });
      setIsEditing(false);
    } catch {
      // Error is already surfaced via toast (useUpdateProfile's onError) and
      // updateProfile.error below for the inline banner.
    }
  };

  const handleLogout = async () => {
    setPending('logout');
    await logout();
    navigate('/', { replace: true });
  };

  const handleLogoutAll = async () => {
    setPending('logout-all');
    await logoutAll();
    navigate('/', { replace: true });
  };

  return (
    <AuthLayout>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1" style={SERIF}>My Account</h1>
      <p className="text-[13px] text-gray-500 mb-6">Manage your profile details</p>

      {isProfileLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      )}

      {!isProfileLoading && profile && !isEditing && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-5 py-4 mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-gray-900 truncate">{profile.name}</p>
              <p className="text-[12.5px] text-gray-500 truncate">{profile.email}</p>
              <p className="text-[12.5px] text-gray-500 mt-1">{profile.phone || 'No phone number on file'}</p>
              <div className="flex items-center gap-1.5 mt-2">
                {profile.isEmailVerified ? (
                  <>
                    <BadgeCheck className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-[11px] text-green-600 font-medium">Email verified</span>
                  </>
                ) : (
                  <>
                    <BadgeAlert className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[11px] text-amber-600 font-medium">Email not verified</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={startEditing}
              className="flex-shrink-0 flex items-center gap-1.5 text-[12px] font-semibold text-purple-700 hover:underline"
              aria-label="Edit profile"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          </div>
        </div>
      )}

      {!isProfileLoading && isEditing && (
        <form onSubmit={handleSave} noValidate className="bg-purple-50 border border-purple-100 rounded-xl px-5 py-5 mb-6 space-y-4">
          {validationError && <AuthErrorBanner message={validationError} />}
          {updateProfile.isError && (
            <AuthErrorBanner
              message={
                updateProfile.error instanceof CustomerAuthApiError
                  ? updateProfile.error.message
                  : 'Failed to update profile. Please try again.'
              }
            />
          )}

          <AuthField label="Full Name" value={name} onChange={setName} required />
          <AuthField
            label="Phone"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="9876543210"
            helperText="Optional"
          />

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="flex-1 py-2.5 text-white text-[13px] font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ background: 'linear-gradient(90deg,#9333EA,#7B22F9)' }}
            >
              {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={updateProfile.isPending}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-[13px] font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <Link
        to="/account/addresses"
        className="w-full flex items-center justify-between gap-2 py-3 px-4 mb-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-gray-700">
          <MapPin className="w-4 h-4 text-purple-600" /> Address Book
        </span>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </Link>

      <Link
        to="/account/orders"
        className="w-full flex items-center justify-between gap-2 py-3 px-4 mb-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-gray-700">
          <Package className="w-4 h-4 text-purple-600" /> My Orders
        </span>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </Link>

      <div className="space-y-3">
        <button
          onClick={handleLogout}
          disabled={pending !== null}
          className="w-full flex items-center justify-center gap-2 py-3 border border-gray-300 text-gray-700 text-[13px] font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {pending === 'logout' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          Log Out
        </button>
        <button
          onClick={handleLogoutAll}
          disabled={pending !== null}
          className="w-full flex items-center justify-center gap-2 py-3 border border-red-200 text-red-600 text-[13px] font-semibold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {pending === 'logout-all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
          Log Out of All Devices
        </button>
      </div>
    </AuthLayout>
  );
};

export default AurusAccount;
