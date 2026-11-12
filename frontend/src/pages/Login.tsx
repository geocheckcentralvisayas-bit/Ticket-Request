import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MailCheck,
  ShieldCheck,
  User,
  WifiOff,
} from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ username: username.trim(), password });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const fieldError =
        err.data?.details?.fieldErrors?.username?.[0] ||
        err.data?.details?.fieldErrors?.password?.[0];
      const message =
        err.status === 429
          ? 'Too many sign-in attempts. Please wait a few minutes before trying again.'
          : err.status === 0 || err.name === 'TypeError'
          ? 'Cannot reach the server. Check your connection and try again.'
          : fieldError || err.data?.error || err.message || 'Unable to sign in';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const detectCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof event.getModifierState === 'function') {
      setCapsLock(event.getModifierState('CapsLock'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-slate-950 px-12 py-16 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl"
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-white p-1 ring-1 ring-white/30 shadow-sm">
              <img src="/denr-logo.svg" alt="DENR seal" className="h-full w-full object-contain" />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-200">DENR-EMB</p>
              <p className="text-lg font-semibold text-white">Region VII · ENVIS</p>
            </div>
          </div>

          <h1 className="mt-16 max-w-md text-4xl font-bold leading-tight text-white">
            Ticket Request &amp; Account Handler Manager
          </h1>
          <p className="mt-4 max-w-md text-primary-100/80">
            Centralized access requests, account provisioning, approvals, and email
            correspondence for ENVIS Region VII.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              { icon: ShieldCheck, title: 'Role-based access', text: 'Approvals are limited to authorized handlers.' },
              { icon: MailCheck, title: 'Email correspondence', text: 'Confirmations and replies are delivered and logged.' },
              { icon: Lock, title: 'Hardened sessions', text: 'Short-lived tokens with encrypted credential storage.' },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <item.icon className="h-5 w-5 text-primary-100" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-sm text-primary-100/70">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-200/60">
          Authorized personnel only. Activity may be monitored for security purposes.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white p-1 shadow-lg shadow-slate-200 ring-1 ring-slate-200">
              <img src="/denr-logo.svg" alt="DENR seal" className="h-full w-full object-contain" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">DENR-EMB Region VII</p>
              <p className="text-lg font-semibold text-slate-900">ENVIS Portal</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
            <div className="mb-7">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Use your ENVIS Region VII credentials to continue.
              </p>
            </div>

            {error && (
              <div
                className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                role="alert"
                aria-live="polite"
              >
                {error.includes('Cannot reach') ? (
                  <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Username
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10 disabled:bg-slate-50"
                    placeholder="your.username"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={detectCapsLock}
                    onKeyDown={detectCapsLock}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-11 pr-12 text-slate-900 placeholder:text-slate-400 transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10 disabled:bg-slate-50"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {capsLock && (
                  <p className="mt-1.5 text-xs font-medium text-amber-600">Caps Lock is on.</p>
                )}
              </div>

              <button
                type="submit"
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading || !username.trim() || !password}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in securely
                    <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p>
                Your credentials are transmitted securely and never displayed in the
                application. Never share your password.
              </p>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-slate-500">
            Need an account?{' '}
            <Link to="/request-access" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
              Request access
            </Link>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} DENR-EMB Region VII · ENVIS
          </p>
        </div>
      </main>
    </div>
  );
}
