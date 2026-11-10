import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Mail, MailX, Pencil, Plus, Power, RefreshCw, Search, Store, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn } from './ui';
import { useCreateVendor, useUpdateVendor, useVendorPage } from '@/hooks/useVendors';
import type { Vendor, VendorStatus } from '@/types';
import {
  apiErrorMessage, fieldForServerError, toVendorPayload, validateVendor,
  type VendorFormErrors, type VendorFormState,
} from './vendors/vendorForm';
import { VendorAccessModal } from './vendors/VendorAccessModal';

const PAGE_SIZE = 20;
const inputCls =
  'w-full mt-1 px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none';
const labelCls = 'text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const StatusPill: React.FC<{ status: VendorStatus }> = ({ status }) => (
  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
    status === 'ACTIVE'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
    {status === 'ACTIVE' ? 'Active' : 'Inactive'}
  </span>
);

// ─── Create / edit dialog ─────────────────────────────────────────────────────
const VendorModal: React.FC<{ vendor?: Vendor; onClose: () => void }> = ({ vendor, onClose }) => {
  const isEdit = !!vendor;
  const create = useCreateVendor();
  const update = useUpdateVendor();
  const pending = create.isPending || update.isPending;
  const [form, setForm] = useState<VendorFormState>({
    name: vendor?.name ?? '',
    email: vendor?.email ?? '',
    status: vendor?.status ?? 'ACTIVE',
    notifyOnOrder: vendor?.notifyOnOrder ?? true,
  });
  const [errors, setErrors] = useState<VendorFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof VendorFormState>(k: K, v: VendorFormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const close = () => { if (!pending) onClose(); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return; // no double submits
    const found = validateVendor(form);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;

    const onError = (err: unknown) => {
      const message = apiErrorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} vendor`);
      const field = fieldForServerError(message);
      if (field) setErrors((x) => ({ ...x, [field]: message }));
      else setServerError(message);
      toast.error(message);
    };
    const payload = toVendorPayload(form);
    if (isEdit) {
      update.mutate({ id: vendor!.id, data: payload }, {
        onSuccess: () => { toast.success('Vendor updated'); onClose(); }, onError,
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => { toast.success('Vendor created'); onClose(); }, onError,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="vendor-modal-title"
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 id="vendor-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">{isEdit ? 'Edit Vendor' : 'Add Vendor'}</h2>
          <button type="button" onClick={close} disabled={pending} aria-label="Close"
            className="text-slate-400 hover:text-slate-600 text-xl font-bold disabled:opacity-40">×</button>
        </div>
        <div className="p-5 space-y-4">
          {serverError && (
            <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {serverError}
            </div>
          )}
          <div>
            <label htmlFor="vendor-name" className={labelCls}>Name *</label>
            <input id="vendor-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} autoFocus
              aria-invalid={!!errors.name}
              className={`${inputCls} ${errors.name ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'}`}
              placeholder="e.g. Suta Boutique" />
            {errors.name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="vendor-email" className={labelCls}>Order email *</label>
            <input id="vendor-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={320}
              aria-invalid={!!errors.email}
              className={`${inputCls} ${errors.email ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'}`}
              placeholder="orders@vendor.com" />
            {errors.email
              ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
              : <p className="mt-1 text-xs text-slate-500">New-order emails listing this vendor's items go here.</p>}
          </div>
          <div>
            <label htmlFor="vendor-status" className={labelCls}>Status</label>
            <select id="vendor-status" value={form.status} onChange={(e) => set('status', e.target.value as VendorStatus)}
              className={`${inputCls} border-slate-300 dark:border-slate-600`}>
              <option value="ACTIVE">Active — can be assigned to products</option>
              <option value="INACTIVE">Inactive — kept on existing products, no order emails</option>
            </select>
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={form.notifyOnOrder} onChange={(e) => set('notifyOnOrder', e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-indigo-600" />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Email this vendor when an order contains their products
            </span>
          </label>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <Btn variant="outline" onClick={close} disabled={pending}>Cancel</Btn>
          <Btn type="submit" disabled={pending}>
            {pending && <RefreshCw size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Vendor'}
          </Btn>
        </div>
      </form>
    </div>
  );
};

// ─── Deactivation confirmation ────────────────────────────────────────────────
const ConfirmDeactivate: React.FC<{ vendor: Vendor; pending: boolean; onCancel: () => void; onConfirm: () => void }> =
  ({ vendor, pending, onCancel, onConfirm }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !pending && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="deactivate-title"
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h2 id="deactivate-title" className="text-lg font-bold text-slate-900 dark:text-white">Deactivate {vendor.name}?</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300 list-disc pl-5">
          <li>They will stop receiving new-order emails.</li>
          <li>They can't be assigned to more products.</li>
          <li>
            {vendor._count?.products
              ? `Their ${vendor._count.products} product(s) keep this vendor and stay on sale.`
              : 'They have no products assigned.'}
          </li>
        </ul>
        <div className="flex justify-end gap-3 mt-5">
          <Btn variant="outline" onClick={onCancel} disabled={pending}>Cancel</Btn>
          <Btn onClick={onConfirm} disabled={pending} className="bg-red-600 hover:bg-red-700">
            {pending && <RefreshCw size={14} className="animate-spin" />} Deactivate
          </Btn>
        </div>
      </div>
    </div>
  );

// ─── Page ─────────────────────────────────────────────────────────────────────
export const Vendors: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | VendorStatus>('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; vendor?: Vendor }>({ open: false });
  const [confirming, setConfirming] = useState<Vendor | null>(null);
  const [access, setAccess] = useState<Vendor | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const update = useUpdateVendor();

  // Debounce search; any filter change returns to page 1.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error, refetch, isFetching } = useVendorPage({
    page, limit: PAGE_SIZE, search: search || undefined, status: status || undefined,
  });
  const vendors = data?.items ?? [];
  const pagination = data?.pagination;
  const filtered = !!search || !!status;

  const setActive = (vendor: Vendor, active: boolean) => {
    if (togglingId) return;
    setTogglingId(vendor.id);
    update.mutate({ id: vendor.id, data: { status: active ? 'ACTIVE' : 'INACTIVE' } }, {
      onSuccess: () => { toast.success(`${vendor.name} ${active ? 'activated' : 'deactivated'}`); setConfirming(null); },
      onError: (err) => toast.error(apiErrorMessage(err, `Failed to ${active ? 'activate' : 'deactivate'} vendor`)),
      onSettled: () => setTogglingId(null),
    });
  };

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle={`Marketplace sellers whose products you sell${pagination ? ` · ${pagination.total} total` : ''}`}
        action={<Btn onClick={() => setModal({ open: true })}><Plus size={16} /> Add Vendor</Btn>}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name or email…"
              aria-label="Search vendors"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value as '' | VendorStatus); setPage(1); }}
            aria-label="Filter by status"
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-500"><RefreshCw size={18} className="animate-spin inline mr-2" />Loading vendors…</div>
        ) : isError ? (
          <div className="p-10 text-center" role="alert">
            <p className="text-sm text-red-600 dark:text-red-400">{apiErrorMessage(error, "Couldn't load vendors")}</p>
            <Btn variant="outline" className="mt-3" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Retry
            </Btn>
          </div>
        ) : vendors.length === 0 ? (
          <div className="p-10 text-center">
            <Store size={28} className="mx-auto text-slate-300 mb-2" />
            {filtered ? (
              <p className="text-sm text-slate-500">No vendors match these filters.</p>
            ) : (
              <>
                <p className="font-semibold text-slate-900 dark:text-white">No vendors yet</p>
                <p className="text-sm text-slate-500 mt-1">Add a vendor, then assign products to them from the product form.</p>
                <Btn className="mt-3" onClick={() => setModal({ open: true })}><Plus size={16} /> Add Vendor</Btn>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-slate-500">
                <tr>
                  <th className="p-3 font-semibold">Vendor</th>
                  <th className="p-3 font-semibold">Email</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Products</th>
                  <th className="p-3 font-semibold">Order emails</th>
                  <th className="p-3 font-semibold">Created</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-slate-100 dark:divide-slate-700 ${isFetching ? 'opacity-60' : ''}`}>
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{v.name}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{v.email}</td>
                    <td className="p-3"><StatusPill status={v.status} /></td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{v._count?.products ?? 0}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">
                      {v.notifyOnOrder
                        ? <span className="inline-flex items-center gap-1"><Mail size={14} className="text-emerald-600" /> On</span>
                        : <span className="inline-flex items-center gap-1"><MailX size={14} className="text-slate-400" /> Off</span>}
                    </td>
                    <td className="p-3 text-slate-500">{fmtDate(v.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Btn variant="ghost" className="px-2 py-1" onClick={() => setModal({ open: true, vendor: v })}>
                          <Pencil size={14} /> Edit
                        </Btn>
                        <Btn variant="ghost" className="px-2 py-1" onClick={() => setAccess(v)}>
                          <Users size={14} /> Portal access
                        </Btn>
                        <Btn variant="ghost" className="px-2 py-1" disabled={togglingId === v.id}
                          onClick={() => (v.status === 'ACTIVE' ? setConfirming(v) : setActive(v, true))}>
                          <Power size={14} /> {v.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} total</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
                aria-label="Next page"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {modal.open && <VendorModal vendor={modal.vendor} onClose={() => setModal({ open: false })} />}
      {access && <VendorAccessModal vendor={access} onClose={() => setAccess(null)} />}
      {confirming && (
        <ConfirmDeactivate vendor={confirming} pending={togglingId === confirming.id}
          onCancel={() => setConfirming(null)} onConfirm={() => setActive(confirming, false)} />
      )}
    </div>
  );
};
