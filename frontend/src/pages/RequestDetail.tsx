import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { ArrowLeft, Mail, Send, Loader2, AlertCircle, CheckCircle, User, Clock } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reqItem, setReqItem] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState({ subject: '', body: '', cc: '', sendEmail: true, isInternal: false });
  const [sending, setSending] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.get<any>(`/requests/${id}`);
      setReqItem(data);
      setMessages(data.messages || []);
      setReply(r => ({ ...r, subject: r.subject || `Re: ${data.ref_number} - ${data.subject}` }));
    } catch (e) {
      console.error(e);
      navigate('/inbox');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const updateStatus = async (status: string) => {
    if (!id) return;
    setStatusUpdating(true); setError(''); setNotice('');
    try {
      await api.patch(`/requests/${id}/status`, { status });
      await fetchData();
      setNotice(`Status updated to ${status}.`);
    } catch (e: any) {
      setError(e.message || 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !reply.body.trim() || !reply.subject.trim()) return;
    setSending(true); setError(''); setNotice('');
    try {
      const res = await api.post<any>(`/requests/${id}/reply`, {
        subject: reply.subject,
        body: reply.body,
        cc: reply.cc ? reply.cc.split(',').map(s=>s.trim()).filter(Boolean) : undefined,
        sendEmail: reply.isInternal ? false : reply.sendEmail,
        isInternal: reply.isInternal,
      });
      setMessages(res.messages || []);
      setReply(r => ({ ...r, body: '', isInternal: false }));
      if (res.email && res.email.success === false) {
        setError(`Message saved but email failed: ${res.email.error || 'unknown error'}`);
      } else if (!reply.isInternal && reply.sendEmail) {
        setNotice('Reply sent by email and saved to conversation.');
      } else {
        setNotice('Message saved.');
      }
      fetchData();
    } catch (e: any) {
      setError(e.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>;
  if (!reqItem) return null;

  const badge = (s: string) => {
    const map: Record<string,string> = { New:'bg-blue-100 text-blue-700', 'In Review':'bg-yellow-100 text-yellow-700', Contacted:'bg-purple-100 text-purple-700', Approved:'bg-green-100 text-green-700', Rejected:'bg-red-100 text-red-700', Closed:'bg-gray-100 text-gray-700' };
    return <span className={`badge ${map[s] || 'bg-gray-100 text-gray-700'}`}>{s}</span>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/inbox')} className="btn-secondary p-2"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{reqItem.subject}</h1>
            {badge(reqItem.status)}
          </div>
          <p className="text-sm text-gray-500 font-mono mt-1">{reqItem.ref_number} • Received {formatDistanceToNow(parseISO(reqItem.created_at), { addSuffix: true })}</p>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700"><AlertCircle className="w-5 h-5" />{error}</div>}
      {notice && <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700"><CheckCircle className="w-5 h-5" />{notice}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Request Message</h3>
            <div className="text-gray-700 whitespace-pre-wrap">{reqItem.message}</div>
          </div>

          <div className="card">
            <div className="p-4 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-900">Conversation & Email History</h3></div>
            <div className="p-4 space-y-4 max-h-[480px] overflow-y-auto scrollbar-thin">
              {messages.length === 0 ? <p className="text-gray-500 text-sm">No messages yet.</p> : messages.map((m) => (
                <div key={m.id} className={`p-4 rounded-lg border ${m.is_internal ? 'bg-amber-50 border-amber-200' : m.direction==='outbound' ? 'bg-primary-50 border-primary-100' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span className="font-medium text-gray-700">
                      {m.direction === 'inbound' ? (m.sender_name || reqItem.full_name) : (m.sender_name || m.user?.full_name || 'ENVIS Team')}
                      {m.is_internal ? ' (Internal note)' : m.channel === 'email' ? ' • Email' : m.channel === 'web' ? ' • Web' : ''}
                    </span>
                    <span>{formatDistanceToNow(parseISO(m.created_at), { addSuffix: true })}</span>
                  </div>
                  {m.subject && <p className="text-sm font-medium text-gray-800 mb-1">{m.subject}</p>}
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.body}</p>
                  {m.recipient_emails && <p className="text-xs text-gray-500 mt-2">To: {m.recipient_emails}</p>}
                </div>
              ))}
            </div>
            <form onSubmit={sendReply} className="p-4 border-t border-gray-200 space-y-3">
              <h4 className="font-medium text-gray-900">Reply to requester</h4>
              <div>
                <label className="label">Subject</label>
                <input className="input" value={reply.subject} onChange={e=>setReply({...reply, subject:e.target.value})} />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea className="input" rows={5} value={reply.body} onChange={e=>setReply({...reply, body:e.target.value})} placeholder="Write your reply..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">CC (comma-separated)</label>
                  <input className="input" value={reply.cc} onChange={e=>setReply({...reply, cc:e.target.value})} placeholder="optional" disabled={reply.isInternal || !reply.sendEmail} />
                </div>
                <div className="flex flex-col justify-end gap-2 pb-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={reply.sendEmail} disabled={reply.isInternal} onChange={e=>setReply({...reply, sendEmail:e.target.checked})} className="rounded border-gray-300" /> Send as email to requester ({reqItem.email})</label>
                  <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={reply.isInternal} onChange={e=>setReply({...reply, isInternal:e.target.checked, sendEmail: e.target.checked ? false : reply.sendEmail})} className="rounded border-gray-300" /> Internal note only (not emailed)</label>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={sending || !reply.body.trim()} className="btn-primary">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />} {reply.isInternal ? 'Save Note' : reply.sendEmail ? 'Send Email Reply' : 'Save Message'}
                </button>
              </div>
              <p className="text-xs text-gray-500">Email replies are sent via SMTP (configured in backend .env) and logged in the Email Outbox.</p>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><User className="w-5 h-5" /> Requester</h3>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="font-medium text-gray-900">{reqItem.full_name}</span></div>
              <div><span className="text-gray-500">Email:</span> <a href={`mailto:${reqItem.email}`} className="font-medium text-primary-600 hover:underline">{reqItem.email}</a></div>
              <div><span className="text-gray-500">Organization:</span> <span className="font-medium text-gray-900">{reqItem.organization || '-'}</span></div>
              <div><span className="text-gray-500">Division:</span> <span className="font-medium text-gray-900">{reqItem.division || '-'}</span></div>
              <div><span className="text-gray-500">Requested role:</span> <span className="font-medium text-gray-900">{reqItem.requested_role || '-'}</span></div>
              <div><span className="text-gray-500">Type:</span> <span className="font-medium text-gray-900">{reqItem.request_type || '-'}</span></div>
              <div><span className="text-gray-500">Source:</span> <span className="font-medium text-gray-900">{reqItem.source}</span></div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Clock className="w-5 h-5" /> Status & Actions</h3>
            <div className="space-y-2">
              {['New','In Review','Contacted','Approved','Rejected','Closed'].map(s => (
                <button key={s} disabled={statusUpdating || reqItem.status===s} onClick={() => updateStatus(s)} className={`w-full text-left px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${reqItem.status===s ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                  {s} {reqItem.status===s ? '(current)' : ''}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">Setting status records an internal timeline entry. Use "Reply" to email the requester.</p>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2"><Mail className="w-5 h-5" /> Email</h3>
            <p className="text-sm text-gray-600 mb-3">Replies sent from this inbox go to <strong>{reqItem.email}</strong> and are logged in Email Outbox.</p>
            <a href={`mailto:${reqItem.email}?subject=${encodeURIComponent('Re: '+reqItem.ref_number+' - '+reqItem.subject)}`} className="btn-secondary w-full justify-center">Open in Mail Client</a>
          </div>
        </div>
      </div>
    </div>
  );
}
