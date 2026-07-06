import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Plus, Pencil, Trash2, Star, Loader2, ArrowLeft,
} from 'lucide-react';
import {
  useAddresses, useCreateAddress, useUpdateAddress, useDeleteAddress,
  useSetDefaultShipping, useSetDefaultBilling,
} from '@/hooks/useCustomerAddresses';
import { CustomerAddress, CustomerAddressInput } from '@/lib/customerAddressApi';
import { useAuth } from '@/context/CustomerAuthContext';
import { UI, SERIF, AuthField } from '@/components/auth/AuthLayout';

const EMPTY_FORM: CustomerAddressInput = {
  label: 'Home', firstName: '', lastName: '', line1: '', line2: '', city: '', state: '', postalCode: '', phone: '',
};

const AddressForm: React.FC<{
  initial: CustomerAddressInput;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (input: CustomerAddressInput) => void;
}> = ({
  initial, isSaving, onCancel, onSubmit,
}) => {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof CustomerAddressInput) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.postalCode.trim()) {
      setError('Address line 1, city, state, and postal code are required.');
      return;
    }
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-[12.5px] rounded-lg px-4 py-3" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AuthField label="Label" value={form.label ?? ''} onChange={set('label')} placeholder="Home, Office, etc." />
        <AuthField label="Phone" type="tel" value={form.phone ?? ''} onChange={set('phone')} placeholder="9876543210" />
        <AuthField label="First Name" value={form.firstName ?? ''} onChange={set('firstName')} />
        <AuthField label="Last Name" value={form.lastName ?? ''} onChange={set('lastName')} />
        <div className="sm:col-span-2">
          <AuthField label="Address Line 1" value={form.line1} onChange={set('line1')} required placeholder="House No., Street, Locality" />
        </div>
        <div className="sm:col-span-2">
          <AuthField label="Address Line 2" value={form.line2 ?? ''} onChange={set('line2')} placeholder="Optional" />
        </div>
        <AuthField label="City" value={form.city} onChange={set('city')} required />
        <AuthField label="State" value={form.state} onChange={set('state')} required />
        <AuthField label="Postal Code" value={form.postalCode} onChange={set('postalCode')} required />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 py-2.5 text-white text-[13px] font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
          style={{ background: 'linear-gradient(90deg,#9333EA,#7B22F9)' }}
        >
          {isSaving ? 'Saving…' : 'Save Address'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-[13px] font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

const AddressCard: React.FC<{
  address: CustomerAddress;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefaultShipping: () => void;
  onSetDefaultBilling: () => void;
  isMutating: boolean;
}> = ({
  address, onEdit, onDelete, onSetDefaultShipping, onSetDefaultBilling, isMutating,
}) => (
  <div className="bg-white rounded-xl shadow-sm p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px] font-bold text-gray-900">{address.label || 'Address'}</span>
          {address.isDefault && (
            <span className="flex items-center gap-1 bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3 fill-purple-700" /> Default
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-gray-700">
          {[address.firstName, address.lastName].filter(Boolean).join(' ') || null}
        </p>
        <p className="text-[12.5px] text-gray-500 mt-0.5">
          {address.line1}{address.line2 ? `, ${address.line2}` : ''}
        </p>
        <p className="text-[12.5px] text-gray-500">
          {address.city}, {address.state} {address.postalCode}
        </p>
        {address.phone && <p className="text-[12.5px] text-gray-500 mt-0.5">{address.phone}</p>}
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <div className="flex gap-3">
          <button onClick={onEdit} className="text-gray-400 hover:text-purple-700 transition-colors" aria-label="Edit address">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="text-gray-400 hover:text-red-600 transition-colors" aria-label="Delete address">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    {!address.isDefault && (
      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={onSetDefaultShipping}
          disabled={isMutating}
          className="flex-1 text-[11.5px] font-semibold text-purple-700 border border-purple-200 rounded-lg py-2 hover:bg-purple-50 transition-colors disabled:opacity-50"
        >
          Set as Default Shipping
        </button>
        <button
          onClick={onSetDefaultBilling}
          disabled={isMutating}
          className="flex-1 text-[11.5px] font-semibold text-purple-700 border border-purple-200 rounded-lg py-2 hover:bg-purple-50 transition-colors disabled:opacity-50"
        >
          Set as Default Billing
        </button>
      </div>
    )}
  </div>
);

const AurusAddressBook: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { data: addresses, isLoading } = useAddresses(isAuthenticated);
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const deleteAddress = useDeleteAddress();
  const setDefaultShipping = useSetDefaultShipping();
  const setDefaultBilling = useSetDefaultBilling();

  const [formMode, setFormMode] = useState<'none' | 'add' | string>('none');

  const isMutating = createAddress.isPending || updateAddress.isPending
    || deleteAddress.isPending || setDefaultShipping.isPending || setDefaultBilling.isPending;

  const editingAddress = typeof formMode === 'string' && formMode !== 'none' && formMode !== 'add'
    ? addresses?.find((a) => a.id === formMode)
    : undefined;

  const handleAdd = (input: CustomerAddressInput) => {
    createAddress.mutate(input, { onSuccess: () => setFormMode('none') });
  };

  const handleUpdate = (id: string, input: CustomerAddressInput) => {
    updateAddress.mutate({ id, input }, { onSuccess: () => setFormMode('none') });
  };

  return (
    <div className="min-h-screen bg-[#F5F3FA]" style={UI}>
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-[1280px] mx-auto px-6 h-[54px] flex items-center gap-4">
          <Link to="/account" className="text-gray-600 hover:text-purple-700 transition-colors flex items-center gap-1.5 text-[13px]">
            <ArrowLeft className="w-4 h-4" /> Back to Account
          </Link>
          <div className="flex-1 text-center">
            <span className="text-[18px] font-light text-gray-900" style={SERIF}>Address Book</span>
          </div>
          <div className="w-[110px]" />
        </div>
      </header>

      <div className="max-w-[720px] mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="w-5 h-5 text-purple-600" />
          <h1 className="text-[20px] font-bold text-gray-900" style={SERIF}>Your Addresses</h1>
        </div>
        <p className="text-[13px] text-gray-500 mb-6">Manage the addresses used for shipping and billing.</p>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        )}

        {!isLoading && (
          <div className="space-y-4 mb-6">
            {addresses?.length === 0 && formMode === 'none' && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <MapPin className="w-8 h-8 text-purple-200 mx-auto mb-3" />
                <p className="text-[13px] text-gray-500">No addresses saved yet.</p>
              </div>
            )}

            {addresses?.map((address) => (
              formMode === address.id ? (
                <AddressForm
                  key={address.id}
                  initial={{
                    label: address.label ?? '',
                    firstName: address.firstName ?? '',
                    lastName: address.lastName ?? '',
                    line1: address.line1,
                    line2: address.line2 ?? '',
                    city: address.city,
                    state: address.state,
                    postalCode: address.postalCode,
                    phone: address.phone ?? '',
                  }}
                  isSaving={updateAddress.isPending}
                  onCancel={() => setFormMode('none')}
                  onSubmit={(input) => handleUpdate(address.id, input)}
                />
              ) : (
                <AddressCard
                  key={address.id}
                  address={address}
                  isMutating={isMutating}
                  onEdit={() => setFormMode(address.id)}
                  onDelete={() => deleteAddress.mutate(address.id)}
                  onSetDefaultShipping={() => setDefaultShipping.mutate(address.id)}
                  onSetDefaultBilling={() => setDefaultBilling.mutate(address.id)}
                />
              )
            ))}
          </div>
        )}

        {!isLoading && formMode === 'add' && (
          <AddressForm
            initial={EMPTY_FORM}
            isSaving={createAddress.isPending}
            onCancel={() => setFormMode('none')}
            onSubmit={handleAdd}
          />
        )}

        {!isLoading && formMode === 'none' && (
          <button
            onClick={() => setFormMode('add')}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-purple-200 text-purple-700 text-[13px] font-semibold rounded-xl hover:bg-purple-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add New Address
          </button>
        )}
      </div>
    </div>
  );
};

export default AurusAddressBook;
