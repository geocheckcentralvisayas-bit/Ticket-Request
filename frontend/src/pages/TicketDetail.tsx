import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Ticket, Message, TicketStatus, AccountStatus } from '@envis/shared';
import { useAuth } from '../hooks/useAuth';
import {
  ArrowLeft,
  MessageSquare,
  Send,
  XCircle,
  Clock,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import TicketRail from '../components/TicketRail';

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canApprove: canApproveHook } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [showInternal, setShowInternal] = useState(false);
  const [showCredentials, setShowCredentials] = useState<Record<number, boolean>>({});
  const [statusAction, setStatusAction] = useState<TicketStatus | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [approvingAccounts, setApprovingAccounts] = useState<Record<number, 'approve' | 'reject' | null>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchTicket = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.get<Ticket>(`/tickets/${id}`);
      setTicket(data);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to fetch ticket:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const sendMessage = async (content: string, isInternal = false) => {
    if (!content.trim() || !ticket) return;
    setSending(true);
    try {
      await api.post<Message>(`/tickets/${ticket.id}/messages`, { content, is_internal: isInternal });
      fetchTicket();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: TicketStatus) => {
    if (!ticket) return;
    try {
      await api.patch(`/tickets/${ticket.id}/status`, { status, note: statusNote });
      fetchTicket();
      setStatusAction(null);
      setStatusNote('');
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleAccountAction = async (accountIds: number[], action: 'approve' | 'reject') => {
    if (!ticket) return;
    const newApproving = { ...approvingAccounts };
    accountIds.forEach(id => newApproving[id] = action);
    setApprovingAccounts(newApproving);

    try {
      await api.post(`/tickets/${ticket.id}/accounts/action`, { accountIds, action, note: internalNote });
      fetchTicket();
      setInternalNote('');
    } catch (error) {
      console.error('Failed to process accounts:', error);
    } finally {
      accountIds.forEach(id => delete newApproving[id]);
      setApprovingAccounts(newApproving);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Ticket not found</h2>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-4">Back to Dashboard</button>
      </div>
    );
  }

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'Open': return 'bg-green-100 text-green-700';
      case 'In Review': return 'bg-yellow-100 text-yellow-700';
      case 'Approved': return 'bg-blue-100 text-blue-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      case 'Closed': return 'bg-gray-100 text-gray-700';
    }
  };

  const getAccountStatusColor = (status: AccountStatus) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-700';
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      case 'Active': return 'bg-blue-100 text-blue-700';
      case 'Disabled': return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-start gap-6">
        <TicketRail activeTicketId={ticket.id} refreshKey={ticket.updated_at} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate('/dashboard')} className="btn-secondary p-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-primary-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
                  <p className="text-sm text-gray-500">{ticket.ticket_number} • {ticket.category} • {ticket.priority}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className={`badge ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                <span className="badge bg-gray-100 text-gray-700">{formatDistanceToNow(parseISO(ticket.created_at), { addSuffix: true })}</span>
                {ticket.assignee && (
                  <span className="badge bg-primary-100 text-primary-700">Assigned: {ticket.assignee.full_name}</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <div className="space-y-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">{ticket.description}</div>
              </div>

              <div className="card">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Conversation
                  </h3>
                  {canApproveHook() && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showInternal}
                        onChange={(e) => setShowInternal(e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-600">Show internal notes</span>
                    </label>
                  )}
                </div>
                <div className="p-4 max-h-[500px] overflow-y-auto scrollbar-thin space-y-4">
                  {messages
                    .filter(m => showInternal || !m.is_internal)
                    .map((message) => (
                      <div key={message.id} className={`flex gap-3 ${message.is_internal ? 'bg-amber-50 rounded-lg p-3' : ''}`}>
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          {message.user?.role === 'Admin' ? (
                            <Lock className="w-4 h-4 text-gray-500" />
                          ) : message.type === 'system' ? (
                            <Clock className="w-4 h-4 text-gray-500" />
                          ) : (
                            <User className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 text-sm">{message.user?.full_name || 'System'}</span>
                            <span className="text-xs text-gray-500">{message.user?.role}</span>
                            {message.is_internal && (
                              <span className="badge bg-amber-100 text-amber-700 text-xs">Internal</span>
                            )}
                            {message.type === 'system' && (
                              <span className="badge bg-gray-100 text-gray-700 text-xs">System</span>
                            )}
                          </div>
                          <p className="text-gray-700 text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatDistanceToNow(parseISO(message.created_at), { addSuffix: true })}</p>
                        </div>
                      </div>
                    ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-gray-200 space-y-3">
                  <div>
                    <label className="label">Public Reply</label>
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      rows={3}
                      className="input"
                      placeholder="Type your message..."
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => sendMessage(newMessage, false)}
                        disabled={sending || !newMessage.trim()}
                        className="btn-primary"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {canApproveHook() && (
                    <div className="border-t border-gray-200 pt-4">
                      <label className="label">Internal Note (visible to handlers only)</label>
                      <textarea
                        value={internalNote}
                        onChange={(e) => setInternalNote(e.target.value)}
                        rows={2}
                        className="input bg-amber-50"
                        placeholder="Internal note for handlers..."
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Request Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Requester</span>
                    <span className="font-medium text-gray-900">{ticket.requester?.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-900">{ticket.requester?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Role</span>
                    <span className="font-medium text-gray-900">{ticket.requester?.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Division</span>
                    <span className="font-medium text-gray-900">{ticket.requester?.division}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created</span>
                    <span className="font-medium text-gray-900">{formatDistanceToNow(parseISO(ticket.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Accounts in Request ({ticket.accounts?.length || 0})
                </h3>
                {ticket.accounts && ticket.accounts.length > 0 ? (
                  <div className="space-y-4">
                    {ticket.accounts.map((account) => (
                      <div key={account.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{account.full_name}</p>
                            <p className="text-sm text-gray-500">@{account.username}</p>
                          </div>
                          <span className={`badge ${getAccountStatusColor(account.status)}`}>{account.status}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="col-span-2 min-w-0">
                            <span className="text-gray-500">Email:</span>
                            <p className="font-medium text-gray-900 break-all">{account.email}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Role:</span>
                            <p className="font-medium text-gray-900">{account.role}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Division:</span>
                            <p className="font-medium text-gray-900">{account.division}</p>
                          </div>
                        </div>
                        {account.generated_password && (
                          <div className="pt-2 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">Generated Password</span>
                              <button
                                onClick={() => setShowCredentials(prev => ({ ...prev, [account.id]: !prev[account.id] }))}
                                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                              >
                                {showCredentials[account.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <code className={`flex-1 bg-gray-100 px-2 py-1 rounded text-sm font-mono ${showCredentials[account.id] ? 'block' : 'hidden'}`}>
                                {account.generated_password}
                              </code>
                              <code className={`flex-1 bg-gray-100 px-2 py-1 rounded text-sm font-mono ${showCredentials[account.id] ? 'hidden' : 'block'}`}>
                                {'•'.repeat(account.generated_password.length)}
                              </code>
                              <button
                                onClick={() => copyToClipboard(account.generated_password!)}
                                className="btn-secondary btn-sm"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                        {canApproveHook() && account.status === 'Pending' && (
                          <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <button
                              onClick={() => handleAccountAction([account.id], 'approve')}
                              disabled={approvingAccounts[account.id] === 'approve'}
                              className="btn-success btn-sm flex-1"
                            >
                              {approvingAccounts[account.id] === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Approve
                            </button>
                            <button
                              onClick={() => handleAccountAction([account.id], 'reject')}
                              disabled={approvingAccounts[account.id] === 'reject'}
                              className="btn-danger btn-sm flex-1"
                            >
                              {approvingAccounts[account.id] === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />} Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {canApproveHook() && ticket.accounts.some(a => a.status === 'Pending') && (
                      <div className="pt-4 border-t border-gray-200 flex gap-2">
                        <button
                          onClick={() => handleAccountAction(
                            ticket.accounts!.filter(a => a.status === 'Pending').map(a => a.id),
                            'approve'
                          )}
                          className="btn-success flex-1"
                        >
                          <Check className="w-4 h-4 mr-1" /> Approve All Pending
                        </button>
                        <button
                          onClick={() => handleAccountAction(
                            ticket.accounts!.filter(a => a.status === 'Pending').map(a => a.id),
                            'reject'
                          )}
                          className="btn-danger flex-1"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject All Pending
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No accounts in this request</p>
                )}
              </div>

              {canApproveHook() && (
                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Actions
                  </h3>
                  <div className="space-y-3">
                    <select
                      value={statusAction || ''}
                      onChange={(e) => setStatusAction(e.target.value as TicketStatus || null)}
                      className="input"
                    >
                      <option value="">Change ticket status...</option>
                      <option value="In Review">In Review</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Closed">Closed</option>
                    </select>
                    {statusAction && (
                      <>
                        <textarea
                          value={statusNote}
                          onChange={(e) => setStatusNote(e.target.value)}
                          rows={2}
                          className="input"
                          placeholder="Note for status change..."
                        />
                        <button
                          onClick={() => updateStatus(statusAction!)}
                          className="btn-primary w-full"
                        >
                          Set to {statusAction}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
