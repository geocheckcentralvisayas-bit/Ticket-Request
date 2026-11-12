import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardCopy,
  Clock3,
  FileSearch,
  Loader2,
  Mail,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

type Tab = 'request' | 'status';

interface FormState {
  full_name: string;
  email: string;
  organization: string;
  division: string;
  requested_role: string;
  request_type: string;
  subject: string;
  message: string;
}

const EMPTY_FORM: FormState = {
  full_name: '',
  email: '',
  organization: '',
  division: '',
  requested_role: '',
  request_type: 'Access Request',
  subject: '',
  message: '',
};

const STATUS_STYLES: Record<string, string> = {
  New: 'bg-blue-50 text-blue-700 ring-blue-200',
  'In Review': 'bg-amber-50 text-amber-700 ring-amber-200',
  Contacted: 'bg-purple-50 text-purple-700 ring-purple-200',
  Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Rejected: 'bg-red-50 text-red-700 ring-red-200',
  Closed: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const STEPS = [
  { icon: Send, title: 'Submit your request', text: 'Tell us who you are and what access you need.' },
  { icon: FileSearch, title: 'We review it', text: 'The ENVIS Region VII team verifies and processes it.' },
  { icon: Mail, title: 'We get back to you', text: 'Updates and replies arrive at your email address.' },
];

export default function RequestAccess() {
  const [tab, setTab] = useState<Tab>('request');

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ ref_number: string; email: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [lookup, setLookup] = useState({ ref_number: '', email: '' });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);

  const update = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const messageLength = form.message.length;
  const canSubmit = useMemo(
    () => form.full_name.trim() && form.email.trim() && form.subject.trim() && form.message.trim(),
    [form]
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post<{ ref_number: string }>('/public/access-requests', form);
      setSubmitted({ ref_number: res.ref_number, email: form.email.trim() });
      setForm(EMPTY_FORM);
    } catch (err: any) {
      setError(
        err.status === 429
          ? 'Too many requests have been submitted from this network. Please try again later.'
          : err.message || 'We could not submit your request. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const doLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLookupError('');
    setLookupResult(null);
    setLookupLoading(true);
    try {
      const res = await api.post('/public/access-requests/lookup', {
        ref_number: lookup.ref_number.trim(),
        email: lookup.email.trim(),
      });
      setLookupResult(res);
    } catch (err: any) {
      setLookupError(
        err.status === 404
          ? 'No request matches that reference number and email address.'
          : err.message || 'Unable to look up this request right now.'
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const copyReference = async () => {
    if (!submitted) return;
    try {
      await navigator.clipboard.writeText(submitted.ref_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const badge = (status: string) => (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status] || STATUS_STYLES.Closed}`}>
      {status}
    </span>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white p-0.5 shadow-sm ring-1 ring-slate-200">
              <img src="/denr-logo.svg" alt="DENR seal" className="h-full w-full object-contain" />
            </span>
            <div className="leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600">DENR-EMB Region VII</p>
              <p className="text-sm font-semibold text-slate-900">ENVIS Access Portal</p>
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Staff sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-slate-950">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-primary-400/20 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-primary-100 ring-1 ring-white/20">
            <Sparkles className="h-3.5 w-3.5" />
            Public access request portal
          </span>
          <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight text-white sm:text-4xl">
            Request access to ENVIS or follow up on your request
          </h1>
          <p className="mt-3 max-w-xl text-primary-100/80">
            Submit a request without signing in. You will receive a reference number and
            email updates from the Region VII support team.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                    <step.icon className="h-4 w-4 text-primary-100" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary-200">Step {index + 1}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-primary-100/70">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Body */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTab('request')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'request' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Send className="h-4 w-4" />
            New request
          </button>
          <button
            type="button"
            onClick={() => setTab('status')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'status' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Search className="h-4 w-4" />
            Check status
          </button>
        </div>

        {tab === 'request' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {submitted ? (
              <div className="p-8 text-center sm:p-12">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 ring-8 ring-emerald-50/60">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-slate-900">Request received</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  Save your reference number — you will need it to check the status of this
                  request.
                </p>

                <div className="mx-auto mt-6 flex max-w-sm items-center justify-between gap-3 rounded-xl border border-dashed border-primary-300 bg-primary-50/60 px-4 py-3">
                  <div className="text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">Reference number</p>
                    <p className="font-mono text-lg font-bold text-primary-800">{submitted.ref_number}</p>
                  </div>
                  <button
                    type="button"
                    onClick={copyReference}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-2.5 py-2 text-xs font-medium text-primary-700 transition hover:bg-primary-50"
                  >
                    {copied ? <ClipboardCheck className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <p className="mx-auto mt-5 flex max-w-md items-start justify-center gap-2 text-xs text-slate-500">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  A confirmation is being sent to <span className="font-medium text-slate-700">{submitted.email}</span>. Check
                  your spam folder if you do not see it.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setSubmitted(null)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 sm:w-auto"
                  >
                    Submit another request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLookup({ ref_number: submitted.ref_number, email: submitted.email });
                      setTab('status');
                      setSubmitted(null);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                  >
                    Track this request
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="divide-y divide-slate-100">
                <div className="p-6 sm:p-8">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-50 text-primary-700">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <h2 className="text-lg font-semibold text-slate-900">Your details</h2>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="full_name" className="mb-1.5 block text-sm font-medium text-slate-700">Full name *</label>
                      <input id="full_name" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10" required value={form.full_name} onChange={update('full_name')} placeholder="Juan Dela Cruz" />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address *</label>
                      <input id="email" type="email" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10" required value={form.email} onChange={update('email')} placeholder="you@example.com" />
                    </div>
                    <div>
                      <label htmlFor="organization" className="mb-1.5 block text-sm font-medium text-slate-700">Organization / office</label>
                      <input id="organization" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10" value={form.organization} onChange={update('organization')} placeholder="DENR-EMB Region VII" />
                    </div>
                    <div>
                      <label htmlFor="division" className="mb-1.5 block text-sm font-medium text-slate-700">Division / unit</label>
                      <input id="division" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10" value={form.division} onChange={update('division')} placeholder="e.g. MIS" />
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-50 text-primary-700">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <h2 className="text-lg font-semibold text-slate-900">Access requested</h2>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="requested_role" className="mb-1.5 block text-sm font-medium text-slate-700">Requested access / role</label>
                      <select id="requested_role" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10" value={form.requested_role} onChange={update('requested_role')}>
                        <option value="">Select…</option>
                        <option value="Regional Director">Regional Director</option>
                        <option value="EMED">EMED</option>
                        <option value="CPD">CPD</option>
                        <option value="MIS">MIS</option>
                        <option value="Extractor">Extractor</option>
                        <option value="GIS">GIS</option>
                        <option value="Other">Other / not sure</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="request_type" className="mb-1.5 block text-sm font-medium text-slate-700">Request type</label>
                      <select id="request_type" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10" value={form.request_type} onChange={update('request_type')}>
                        <option>Access Request</option>
                        <option>New Account</option>
                        <option>Access Change</option>
                        <option>Password Reset</option>
                        <option>Deactivation</option>
                        <option>Issue / Support</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-slate-700">Subject *</label>
                      <input id="subject" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10" required maxLength={200} value={form.subject} onChange={update('subject')} placeholder="Brief summary of your request" />
                    </div>
                    <div className="sm:col-span-2">
                      <div className="mb-1.5 flex items-center justify-between">
                        <label htmlFor="message" className="block text-sm font-medium text-slate-700">Message / details *</label>
                        <span className={`text-xs ${messageLength > 4800 ? 'text-amber-600' : 'text-slate-400'}`}>{messageLength}/5000</span>
                      </div>
                      <textarea
                        id="message"
                        className="w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10"
                        required
                        rows={6}
                        maxLength={5000}
                        value={form.message}
                        onChange={update('message')}
                        placeholder="Describe what access you need, why, and any relevant details…"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 bg-slate-50/70 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                  <p className="text-xs text-slate-500">
                    Fields marked * are required. We only use your details to process this request.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting || !canSubmit}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {submitting ? 'Submitting…' : 'Submit request'}
                  </button>
                </div>

                {error && (
                  <div className="flex items-start gap-3 border-t border-red-100 bg-red-50 p-4 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        {tab === 'status' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-50 text-primary-700">
                  <Clock3 className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-semibold text-slate-900">Track your request</h2>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Enter the reference number from your confirmation email together with the email
                address you used.
              </p>

              <form onSubmit={doLookup} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ref" className="mb-1.5 block text-sm font-medium text-slate-700">Reference number *</label>
                    <input id="ref" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm uppercase tracking-wide transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10" required value={lookup.ref_number} onChange={(e) => setLookup({ ...lookup, ref_number: e.target.value })} placeholder="REQ-YYYYMMDD-####" />
                  </div>
                  <div>
                    <label htmlFor="lookup-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address *</label>
                    <input id="lookup-email" type="email" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10" required value={lookup.email} onChange={(e) => setLookup({ ...lookup, email: e.target.value })} placeholder="Email used in the request" />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
                >
                  {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Check status
                </button>
              </form>

              {lookupError && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{lookupError}</p>
                </div>
              )}
            </div>

            {lookupResult && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reference</p>
                    <p className="font-mono text-lg font-bold text-slate-900">{lookupResult.request.ref_number}</p>
                    <p className="mt-1 text-sm text-slate-500">{lookupResult.request.subject}</p>
                  </div>
                  {badge(lookupResult.request.status)}
                </div>

                <div className="p-6 sm:p-8">
                  <h3 className="text-sm font-semibold text-slate-900">Updates</h3>
                  <div className="mt-4 space-y-3">
                    {lookupResult.messages?.length ? (
                      lookupResult.messages.map((m: any) => (
                        <div
                          key={m.id}
                          className={`rounded-xl border p-4 ${
                            m.direction === 'outbound'
                              ? 'border-primary-100 bg-primary-50/60'
                              : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-slate-500">
                            <span className="font-medium text-slate-700">
                              {m.direction === 'outbound' ? m.sender_name || 'ENVIS Team' : 'You'}
                            </span>
                            <span>{new Date(m.created_at).toLocaleString()}</span>
                          </div>
                          {m.subject && <p className="mb-1 text-sm font-medium text-slate-800">{m.subject}</p>}
                          <p className="whitespace-pre-wrap text-sm text-slate-700">{m.body}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No public updates yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          DENR-EMB Region VII · ENVIS Ticket Request &amp; Account Handler Manager
        </p>
      </main>
    </div>
  );
}
