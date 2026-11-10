import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, RefreshCw, Store } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Btn, Card } from '@/admin/ui';
import { apiErrorMessage } from '@/admin/vendors/vendorForm';
import {
  STORE_ID, VendorProfile, refreshSession, setAccessToken, setSignedOutHandler, vendorAuth,
} from './api';
import { hashWithoutQuery, passwordProblem, tokenFromHash } from './lib';

// ─── Session ──────────────────────────────────────────────────────────────────

type SessionState = { status: 'loading' } | { status: 'anonymous' } | { status: 'signed-in'; vendor: VendorProfile };
interface SessionApi {
  state: SessionState;
  signedIn: (s: { accessToken: string; vendor: VendorProfile }) => void;
  setVendor: (v: VendorProfile) => void;
  signOut: () => Promise<void>;
}
const SessionContext = createContext<SessionApi | null>(null);
const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside provider');
  return ctx;
};

const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    setSignedOutHandler(() => setState({ status: 'anonymous' }));
    // A page reload loses the in-memory access token; the httpOnly cookie restores it.
    refreshSession()
      .then((s) => setState({ status: 'signed-in', vendor: s.vendor }))
      .catch(() => setState({ status: 'anonymous' }));
  }, []);

  const signedIn = useCallback((s: { accessToken: string; vendor: VendorProfile }) => {
    setAccessToken(s.accessToken);
    setState({ status: 'signed-in', vendor: s.vendor });
  }, []);
  const setVendor = useCallback((vendor: VendorProfile) => setState({ status: 'signed-in', vendor }), []);
  const signOut = useCallback(async () => {
    await vendorAuth.logout();
    setAccessToken(null);
    setState({ status: 'anonymous' });
  }, []);

  return <SessionContext.Provider value={{ state, signedIn, setVendor, signOut }}>{children}</SessionContext.Provider>;
};

// ─── Shared bits ──────────────────────────────────────────────────────────────

const inputCls =
  'w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none';
const labelCls = 'text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide';

const AuthShell: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
    <Card className="w-full max-w-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center"><Store size={18} /></div>
        <div>
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Vendor portal</p>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{title}</h1>
        </div>
      </div>
      {subtitle && <p className="text-sm text-slate-500 mb-4">{subtitle}</p>}
      {children}
    </Card>
  </div>
);

const ErrorNote: React.FC<{ message: string | null }> = ({ message }) =>
  message ? <p role="alert" className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">{message}</p> : null;

const SubmitBtn: React.FC<{ pending: boolean; children: React.ReactNode }> = ({ pending, children }) => (
  <Btn type="submit" disabled={pending} className="w-full justify-center">
    {pending && <RefreshCw size={14} className="animate-spin" />} {children}
  </Btn>
);

/**
 * Takes the one-time token out of the link and immediately removes it from the
 * address bar (and so from history / bookmarks / screenshots).
 */
function useLinkToken(): string | null {
  const [token] = useState(() => tokenFromHash(window.location.hash));
  useEffect(() => {
    if (token) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hashWithoutQuery(window.location.hash)}`);
  }, [token]);
  return token;
}

const PasswordFields: React.FC<{
  password: string; confirm: string; setPassword: (v: string) => void; setConfirm: (v: string) => void; label?: string;
}> = ({ password, confirm, setPassword, setConfirm, label = 'New password' }) => (
  <>
    <div>
      <label htmlFor="pw" className={labelCls}>{label}</label>
      <input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
      <p className="mt-1 text-xs text-slate-500">8+ characters with an uppercase letter, a lowercase letter and a number.</p>
    </div>
    <div>
      <label htmlFor="pw2" className={labelCls}>Confirm password</label>
      <input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
    </div>
  </>
);

const checkNewPassword = (password: string, confirm: string) =>
  passwordProblem(password) ?? (password !== confirm ? 'The passwords do not match.' : null);

// ─── Pages ────────────────────────────────────────────────────────────────────

const LoginPage: React.FC = () => {
  const { signedIn } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setPending(true); setError(null);
    try {
      signedIn(await vendorAuth.login(email.trim(), password));
      navigate('/', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Sign-in failed'));
    } finally { setPending(false); }
  };

  return (
    <AuthShell title="Sign in">
      {!STORE_ID && <ErrorNote message="This portal link is missing its store. Use the link from your invitation email." />}
      <form onSubmit={submit} noValidate className="space-y-4">
        <ErrorNote message={error} />
        <div>
          <label htmlFor="email" className={labelCls}>Email</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoFocus />
        </div>
        <div>
          <label htmlFor="password" className={labelCls}>Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </div>
        <SubmitBtn pending={pending}>Sign in</SubmitBtn>
        <p className="text-center text-sm"><Link to="/forgot-password" className="text-indigo-600 hover:underline">Forgot password?</Link></p>
      </form>
    </AuthShell>
  );
};

const AcceptInvitePage: React.FC = () => {
  const token = useLinkToken();
  const { signedIn } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !token) return;
    const problem = checkNewPassword(password, confirm);
    setError(problem);
    if (problem) return;
    setPending(true);
    try {
      signedIn(await vendorAuth.acceptInvite(token, password));
      toast.success('Your account is active');
      navigate('/', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not activate your account'));
    } finally { setPending(false); }
  };

  if (!token) {
    return (
      <AuthShell title="Invitation link not valid" subtitle="Open the link from your invitation email again, or ask the store owner to resend it.">
        <Link to="/login" className="text-sm text-indigo-600 hover:underline">Go to sign in</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Activate your account" subtitle="Choose a password to finish setting up your vendor portal access.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <ErrorNote message={error} />
        <PasswordFields password={password} confirm={confirm} setPassword={setPassword} setConfirm={setConfirm} label="Password" />
        <SubmitBtn pending={pending}>Activate and sign in</SubmitBtn>
      </form>
    </AuthShell>
  );
};

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setPending(true); setError(null);
    try {
      setDone((await vendorAuth.forgotPassword(email.trim())).message);
    } catch (err) {
      setError(apiErrorMessage(err, 'Something went wrong — try again'));
    } finally { setPending(false); }
  };

  return (
    <AuthShell title="Reset your password">
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">{done}</p>
          <Link to="/login" className="text-sm text-indigo-600 hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <ErrorNote message={error} />
          <div>
            <label htmlFor="email" className={labelCls}>Email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoFocus />
          </div>
          <SubmitBtn pending={pending}>Email me a reset link</SubmitBtn>
          <p className="text-center text-sm"><Link to="/login" className="text-indigo-600 hover:underline">Back to sign in</Link></p>
        </form>
      )}
    </AuthShell>
  );
};

const ResetPasswordPage: React.FC = () => {
  const token = useLinkToken();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !token) return;
    const problem = checkNewPassword(password, confirm);
    setError(problem);
    if (problem) return;
    setPending(true);
    try {
      toast.success((await vendorAuth.resetPassword(token, password)).message);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reset your password'));
    } finally { setPending(false); }
  };

  if (!token) {
    return (
      <AuthShell title="Reset link not valid" subtitle="Reset links work once and expire after 60 minutes. Request a new one.">
        <Link to="/forgot-password" className="text-sm text-indigo-600 hover:underline">Request a new link</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" subtitle="You'll be signed out everywhere else.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <ErrorNote message={error} />
        <PasswordFields password={password} confirm={confirm} setPassword={setPassword} setConfirm={setConfirm} />
        <SubmitBtn pending={pending}>Update password</SubmitBtn>
      </form>
    </AuthShell>
  );
};

const AccountPage: React.FC<{ vendor: VendorProfile }> = ({ vendor }) => {
  const { signedIn, setVendor, signOut } = useSession();
  const [name, setName] = useState(vendor.name);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingName) return;
    if (!name.trim()) { toast.error('Name cannot be empty'); return; }
    setSavingName(true);
    try { setVendor(await vendorAuth.updateName(name.trim())); toast.success('Name updated'); }
    catch (err) { toast.error(apiErrorMessage(err, 'Could not update your name')); }
    finally { setSavingName(false); }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPw) return;
    const problem = pw.current ? checkNewPassword(pw.next, pw.confirm) : 'Enter your current password.';
    setPwError(problem);
    if (problem) return;
    setSavingPw(true);
    try {
      signedIn(await vendorAuth.changePassword(pw.current, pw.next));
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password changed — other sessions were signed out');
    } catch (err) { setPwError(apiErrorMessage(err, 'Could not change your password')); }
    finally { setSavingPw(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0"><Store size={16} /></div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 dark:text-white truncate">{vendor.vendor.name}</p>
              <p className="text-xs text-slate-500 truncate">Vendor portal · {vendor.store.name}</p>
            </div>
          </div>
          <Btn variant="outline" disabled={signingOut} onClick={async () => { setSigningOut(true); await signOut(); }}>
            <LogOut size={14} /> Sign out
          </Btn>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <Card className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white">Welcome, {vendor.name}</h2>
          <p className="text-sm text-slate-500 mt-1">
            Your account is active. Product, inventory and order tools will appear here once they are enabled for vendors.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-3">Profile</h2>
          <form onSubmit={saveName} noValidate className="space-y-3">
            <div>
              <label htmlFor="name" className={labelCls}>Name</label>
              <input id="name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <p className={labelCls}>Email</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{vendor.email} <span className="text-xs text-slate-400">(ask the store owner to change it)</span></p>
            </div>
            <Btn type="submit" disabled={savingName || name.trim() === vendor.name}>
              {savingName && <RefreshCw size={14} className="animate-spin" />} Save name
            </Btn>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><KeyRound size={16} /> Change password</h2>
          <form onSubmit={savePassword} noValidate className="space-y-3">
            <ErrorNote message={pwError} />
            <div>
              <label htmlFor="cur" className={labelCls}>Current password</label>
              <input id="cur" type="password" autoComplete="current-password" value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} className={inputCls} />
            </div>
            <PasswordFields password={pw.next} confirm={pw.confirm}
              setPassword={(v) => setPw((p) => ({ ...p, next: v }))} setConfirm={(v) => setPw((p) => ({ ...p, confirm: v }))} />
            <Btn type="submit" disabled={savingPw}>{savingPw && <RefreshCw size={14} className="animate-spin" />} Change password</Btn>
          </form>
        </Card>
      </main>
    </div>
  );
};

// ─── Routing ──────────────────────────────────────────────────────────────────

const Routed: React.FC = () => {
  const { state } = useSession();
  const location = useLocation();
  if (state.status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500"><RefreshCw size={16} className="animate-spin mr-2" /> Loading…</div>;
  }
  const signedIn = state.status === 'signed-in';
  return (
    <Routes>
      <Route path="/" element={signedIn ? <AccountPage vendor={state.vendor} /> : <Navigate to="/login" replace state={{ from: location }} />} />
      <Route path="/login" element={signedIn ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const VendorApp: React.FC = () => (
  <SessionProvider>
    <HashRouter>
      <Routed />
    </HashRouter>
    <Toaster richColors position="top-right" />
  </SessionProvider>
);
