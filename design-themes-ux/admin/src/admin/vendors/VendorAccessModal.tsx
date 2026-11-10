import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Mail, RefreshCw, ShieldOff, UserCheck, UserPlus, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Btn } from '../ui';
import { useAuth } from '@/contexts/AuthContext';
import type { Vendor } from '@/types';
import { vendorUserService, type AuthEmailOutcome, type VendorUser, type VendorUserStatus } from '@/services/vendorUserService';
import { apiErrorMessage, validateVendor } from './vendorForm';

const STATUS_STYLE: Record<VendorUserStatus, string> = {
  INVITED:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  ACTIVE:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  SUSPENDED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  REVOKED:   'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
};
const STATUS_LABEL: Record<VendorUserStatus, string> = {
  INVITED: 'Invited', ACTIVE: 'Active', SUSPENDED: 'Suspended', REVOKED: 'Revoked',
};

/** Tells the owner whether the email actually left — never shows the link itself. */
function emailToast(outcome: AuthEmailOutcome, what: string) {
  if (outcome === 'sent') toast.success(`${what} email sent`);
  else if (outcome === 'not_configured') toast.warning(`${what} created, but email is not configured on the server — it was not sent`);
  else toast.error(`${what} created, but the email could not be delivered. Try "Resend" later.`);
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

// Owner-only portal-account management for one vendor. Managers see the list
// read-only. The backend enforces both — hiding buttons is only a convenience.
export const VendorAccessModal: React.FC<{ vendor: Vendor; onClose: () => void }> = ({ vendor, onClose }) => {
  const { user } = useAuth();
  const canManage = user?.role === 'STORE_OWNER' || user?.role === 'SUPER_ADMIN';
  const qc = useQueryClient();
  const key = ['vendor-users', vendor.id];
  const { data: users = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: key, queryFn: () => vendorUserService.list(vendor.id),
  });

  const [form, setForm] = useState({ name: '', email: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<VendorUser | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const invite = useMutation({
    mutationFn: () => vendorUserService.invite(vendor.id, { name: form.name.trim(), email: form.email.trim() }),
    onSuccess: (r) => { emailToast(r.invitation, 'Invitation'); setForm({ name: '', email: '' }); refresh(); },
    onError: (e) => { const m = apiErrorMessage(e, 'Could not send the invitation'); setFormError(m); toast.error(m); },
  });
  const act = useMutation({
    mutationFn: async (a: { kind: 'resend' | 'reset' | 'status'; user: VendorUser; status?: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' }) => {
      if (a.kind === 'resend') emailToast((await vendorUserService.resendInvitation(vendor.id, a.user.id)).invitation, 'Invitation');
      else if (a.kind === 'reset') emailToast((await vendorUserService.sendPasswordReset(vendor.id, a.user.id)).email, 'Password reset');
      else {
        await vendorUserService.setStatus(vendor.id, a.user.id, a.status!);
        toast.success(`${a.user.name}: ${STATUS_LABEL[a.status!].toLowerCase()}`);
      }
    },
    onSuccess: () => { setConfirmRevoke(null); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e, 'Action failed')),
  });

  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (invite.isPending) return;
    const errors = validateVendor({ name: form.name, email: form.email, status: 'ACTIVE', notifyOnOrder: true });
    const first = errors.name ?? errors.email;
    setFormError(first ?? null);
    if (!first) invite.mutate();
  };
  const busy = act.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && !invite.isPending && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="access-title" onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 id="access-title" className="text-lg font-bold text-slate-900 dark:text-white">Portal access — {vendor.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">People who can sign in to the vendor portal for this vendor.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {vendor.status !== 'ACTIVE' && (
            <p className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-300">
              This vendor is inactive, so none of its users can sign in. Activate the vendor to restore access or send invitations.
            </p>
          )}

          {canManage && vendor.status === 'ACTIVE' && (
            <form onSubmit={submitInvite} noValidate className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-start">
              <input aria-label="Name" placeholder="Name" value={form.name} maxLength={200}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setFormError(null); }}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white" />
              <input aria-label="Email" type="email" placeholder="email@vendor.com" value={form.email} maxLength={320}
                onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setFormError(null); }}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white" />
              <Btn type="submit" disabled={invite.isPending}>
                {invite.isPending ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />} Invite
              </Btn>
              {formError && <p role="alert" className="sm:col-span-3 text-xs text-red-600 dark:text-red-400">{formError}</p>}
            </form>
          )}
          {!canManage && <p className="text-xs text-slate-500">Only the store owner can invite people or change their access.</p>}

          {isLoading ? (
            <p className="text-sm text-slate-500"><RefreshCw size={14} className="animate-spin inline mr-1" /> Loading accounts…</p>
          ) : isError ? (
            <div role="alert" className="text-sm text-red-600 dark:text-red-400">
              {apiErrorMessage(error, "Couldn't load accounts")}{' '}
              <button type="button" className="underline" onClick={() => refetch()} disabled={isFetching}>Retry</button>
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-500">No one has portal access yet{canManage ? ' — invite someone above.' : '.'}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl">
              {users.map((u) => (
                <li key={u.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                      {u.name} <span className={`ml-1 inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[u.status]}`}>{STATUS_LABEL[u.status]}</span>
                      {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                        <span className="ml-1 text-[11px] text-red-600">locked until {fmt(u.lockedUntil)}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{u.email} · last sign-in {fmt(u.lastLoginAt)}</p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-1">
                      {u.status === 'INVITED' && (
                        <Btn variant="ghost" className="px-2 py-1 text-xs" disabled={busy} onClick={() => act.mutate({ kind: 'resend', user: u })}>
                          <Mail size={13} /> Resend invite
                        </Btn>
                      )}
                      {u.status === 'ACTIVE' && (
                        <>
                          <Btn variant="ghost" className="px-2 py-1 text-xs" disabled={busy} onClick={() => act.mutate({ kind: 'reset', user: u })}>
                            <KeyRound size={13} /> Send reset
                          </Btn>
                          <Btn variant="ghost" className="px-2 py-1 text-xs" disabled={busy} onClick={() => act.mutate({ kind: 'status', user: u, status: 'SUSPENDED' })}>
                            <ShieldOff size={13} /> Suspend
                          </Btn>
                        </>
                      )}
                      {u.status === 'SUSPENDED' && (
                        <Btn variant="ghost" className="px-2 py-1 text-xs" disabled={busy} onClick={() => act.mutate({ kind: 'status', user: u, status: 'ACTIVE' })}>
                          <UserCheck size={13} /> Reactivate
                        </Btn>
                      )}
                      {u.status !== 'REVOKED' && (
                        <Btn variant="ghost" className="px-2 py-1 text-xs text-red-600" disabled={busy} onClick={() => setConfirmRevoke(u)}>
                          <UserX size={13} /> Revoke
                        </Btn>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {confirmRevoke && (
          <div className="p-5 border-t border-slate-200 dark:border-slate-700 bg-red-50 dark:bg-red-900/20 rounded-b-2xl" role="alertdialog" aria-labelledby="revoke-title">
            <p id="revoke-title" className="text-sm font-semibold text-red-700 dark:text-red-300">
              Revoke {confirmRevoke.name}'s access?
            </p>
            <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1">
              They are signed out everywhere immediately and their password is removed. Only a new invitation can restore access.
            </p>
            <div className="flex justify-end gap-2 mt-3">
              <Btn variant="outline" onClick={() => setConfirmRevoke(null)} disabled={busy}>Cancel</Btn>
              <Btn className="bg-red-600 hover:bg-red-700" disabled={busy}
                onClick={() => act.mutate({ kind: 'status', user: confirmRevoke, status: 'REVOKED' })}>
                {busy && <RefreshCw size={14} className="animate-spin" />} Revoke access
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
