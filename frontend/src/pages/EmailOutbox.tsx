import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import {
  Search,
  RefreshCw,
  Loader2,
  Send,
  AlertCircle,
  CheckCircle,
  Clock,
  RotateCcw,
  Eye,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

export default function EmailOutbox() {
  const { hasPermission } = useAuth();
  const canDelete = hasPermission('manage_settings');
  const [emails, setEmails] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed' | 'pending'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCompose, setShowCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});
  const [clearing, setClearing] = useState(false);
  const [formData, setFormData] = useState({
    to: '',
    cc: '',
    subject: '',
    body: '',
  });

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: page.toString(), limit: '50' };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;

      const data = await api.get<{ emails: any[]; total: number; page: number; limit: number }>('/emails', params);
      setEmails(data.emails);
      setTotalPages(Math.ceil(data.total / 50));
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.get<any>('/emails/stats');
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchEmails();
    fetchStats();
  }, [page, statusFilter, search]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.to.trim() || !formData.subject.trim() || !formData.body.trim()) return;

    setSending(true);
    try {
      await api.post('/emails/send', {
        to: formData.to.split(',').map(e => e.trim()),
        cc: formData.cc ? formData.cc.split(',').map(e => e.trim()) : undefined,
        subject: formData.subject,
        body: formData.body,
      });
      setShowCompose(false);
      setFormData({ to: '', cc: '', subject: '', body: '' });
      fetchEmails();
      fetchStats();
    } catch (error: any) {
      alert(error.data?.error || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleRetry = async (emailId: number) => {
    setRetrying(prev => ({ ...prev, [emailId]: true }));
    try {
      await api.post(`/emails/${emailId}/retry`);
      fetchEmails();
      fetchStats();
    } catch (error: any) {
      alert(error.data?.error || 'Failed to retry');
    } finally {
      setRetrying(prev => { const n = { ...prev }; delete n[emailId]; return n; });
    }
  };

  const handleDelete = async (emailId: number) => {
    if (!window.confirm('Delete this email log? This only removes the record and cannot be undone.')) return;
    setDeleting(prev => ({ ...prev, [emailId]: true }));
    try {
      await api.delete(`/emails/${emailId}`);
      fetchEmails();
      fetchStats();
    } catch (error: any) {
      alert(error.data?.error || 'Failed to delete email log');
    } finally {
      setDeleting(prev => { const n = { ...prev }; delete n[emailId]; return n; });
    }
  };

  const handleClear = async () => {
    const scope = statusFilter === 'all' ? 'all' : statusFilter;
    const label = scope === 'all' ? 'all email logs' : `all ${scope} email logs`;
    if (!window.confirm(`Delete ${label}? This only removes records and cannot be undone.`)) return;
    setClearing(true);
    try {
      const endpoint = scope === 'all' ? '/emails' : `/emails?status=${scope}`;
      await api.delete(endpoint);
      setPage(1);
      fetchEmails();
      fetchStats();
    } catch (error: any) {
      alert(error.data?.error || 'Failed to clear email logs');
    } finally {
      setClearing(false);
    }
  };

  const testConnection = async () => {
    try {
      await api.post('/emails/test');
      alert('SMTP connection successful!');
    } catch (error: any) {
      alert(error.data?.error || 'SMTP connection failed');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <span className="badge bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Sent</span>;
      case 'failed': return <span className="badge bg-red-100 text-red-700 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Failed</span>;
      case 'pending': return <span className="badge bg-yellow-100 text-yellow-700 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
      default: return <span className="badge bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Outbox</h1>
          <p className="text-gray-500 mt-1">View and manage all sent emails</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowCompose(true)} className="btn-primary">
            <Send className="w-4 h-4 mr-2" /> Compose
          </button>
          <button onClick={testConnection} className="btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2" /> Test SMTP
          </button>
          {canDelete && (
            <button
              onClick={handleClear}
              disabled={clearing || stats.total === 0}
              className="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              title={statusFilter === 'all' ? 'Delete all email logs' : `Delete ${statusFilter} email logs`}
            >
              {clearing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {statusFilter === 'all' ? 'Clear Logs' : `Clear ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`}
            </button>
          )}
          <button onClick={() => { fetchEmails(); fetchStats(); }} className="btn-secondary" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Sent</p>
          <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Failed</p>
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
      </div>

      {showCompose && (
        <div className="card p-6" style={{ animation: 'slideDown 0.2s ease-out' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Compose Email</h3>
            <button onClick={() => setShowCompose(false)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="label">To *</label>
              <input
                type="text"
                value={formData.to}
                onChange={(e) => setFormData(prev => ({ ...prev, to: e.target.value }))}
                className="input"
                placeholder="recipient1@example.com, recipient2@example.com"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated email addresses</p>
            </div>
            <div>
              <label className="label">CC</label>
              <input
                type="text"
                value={formData.cc}
                onChange={(e) => setFormData(prev => ({ ...prev, cc: e.target.value }))}
                className="input"
                placeholder="cc@example.com"
              />
            </div>
            <div>
              <label className="label">Subject *</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                className="input"
                placeholder="Email subject"
              />
            </div>
            <div>
              <label className="label">Body (HTML) *</label>
              <textarea
                value={formData.body}
                onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                rows={8}
                className="input font-mono text-sm"
                placeholder="<p>Email body with HTML support</p>"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button type="button" onClick={() => setShowCompose(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={sending} className="btn-primary">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Send
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search emails..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
            className="input py-2 px-3 min-w-[150px]"
          >
            <option value="all">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">CC</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3 hidden md:table-cell">Ticket</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                      <span className="text-gray-500">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">No emails found</td>
                </tr>
              ) : (
                emails.map((email) => (
                  <tr key={email.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">{getStatusBadge(email.status)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700 max-w-xs truncate">{email.to_emails}</td>
                    <td className="px-4 py-4 text-sm text-gray-500 max-w-xs truncate">{email.cc_emails || '-'}</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900 max-w-md truncate" title={email.subject}>{email.subject}</td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      {email.ticket_number && (
                        <a href={`/tickets/${email.ticket_id}`} className="text-primary-600 hover:underline text-sm font-mono block">
                          {email.ticket_number}
                        </a>
                      )}
                      {email.request_ref && (
                        <a href={`/inbox/${email.request_id}`} className="text-teal-600 hover:underline text-sm font-mono block">
                          {email.request_ref}
                        </a>
                      )}
                      {!email.ticket_number && !email.request_ref && '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {email.sent_at ? formatDistanceToNow(parseISO(email.sent_at), { addSuffix: true }) : 'Not sent'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRetry(email.id)}
                          disabled={retrying[email.id] || email.status === 'sent'}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
                          title={email.status === 'sent' ? 'Already sent' : 'Retry sending'}
                        >
                          {retrying[email.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => alert(`Subject: ${email.subject}\n\nTo: ${email.to_emails}\n\nCC: ${email.cc_emails || 'None'}\n\nBody:\n${email.body}`)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(email.id)}
                            disabled={deleting[email.id]}
                            className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 disabled:opacity-50 transition-colors"
                            title="Delete log"
                          >
                            {deleting[email.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}