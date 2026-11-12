import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Ticket, TicketCategory, TicketStatus } from '@envis/shared';
import {
  Plus,
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  MoreVertical,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

const CATEGORIES: { value: TicketCategory | 'all'; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'New Account', label: 'New Account', icon: <FileText className="w-4 h-4" /> },
  { value: 'Access Change', label: 'Access Change', icon: <AlertCircle className="w-4 h-4" /> },
  { value: 'Reset', label: 'Reset', icon: <Clock className="w-4 h-4" /> },
  { value: 'Deactivation', label: 'Deactivation', icon: <XCircle className="w-4 h-4" /> },
  { value: 'Issue', label: 'Issue', icon: <AlertCircle className="w-4 h-4" /> },
];

const STATUSES: { value: TicketStatus | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All Statuses', color: 'bg-gray-100 text-gray-700' },
  { value: 'Open', label: 'Open', color: 'bg-green-100 text-green-700' },
  { value: 'In Review', label: 'In Review', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'Approved', label: 'Approved', color: 'bg-blue-100 text-blue-700' },
  { value: 'Rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
  { value: 'Closed', label: 'Closed', color: 'bg-gray-100 text-gray-700' },
];

const STATUS_ICONS: Record<TicketStatus, React.ReactNode> = {
  Open: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
  'In Review': <Clock className="w-3.5 h-3.5 text-yellow-500" />,
  Approved: <CheckCircle className="w-3.5 h-3.5 text-blue-500" />,
  Rejected: <XCircle className="w-3.5 h-3.5 text-red-500" />,
  Closed: <FileText className="w-3.5 h-3.5 text-gray-500" />,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, in_review: 0, approved: 0, rejected: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: page.toString(), limit: '20' };
      if (search) params.search = search;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const data = await api.get<{ tickets: Ticket[]; total: number; page: number; limit: number }>('/tickets', params);
      setTickets(data.tickets);
      setTotalPages(Math.ceil(data.total / 20));
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await api.get<{
        total: number;
        open: number;
        in_review: number;
        approved: number;
        rejected: number;
        closed: number;
        byCategory: { category: string; count: number }[];
      }>('/tickets/stats');
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, [page, search, categoryFilter, statusFilter]);

  const filteredTickets = tickets;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Medium': return 'bg-yellow-100 text-yellow-700';
      case 'Low': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getCategoryIcon = (category: TicketCategory) => {
    switch (category) {
      case 'New Account': return <FileText className="w-4 h-4" />;
      case 'Access Change': return <AlertCircle className="w-4 h-4" />;
      case 'Reset': return <Clock className="w-4 h-4" />;
      case 'Deactivation': return <XCircle className="w-4 h-4" />;
      case 'Issue': return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ticket Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Manage and track all ticket requests</p>
        </div>
        <Link
          to="/tickets/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          New Ticket
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-900', ring: 'bg-slate-100 text-slate-600', icon: FileText },
          { label: 'Open', value: stats.open, color: 'text-emerald-600', ring: 'bg-emerald-50 text-emerald-600', icon: MessageSquare },
          { label: 'In Review', value: stats.in_review, color: 'text-amber-600', ring: 'bg-amber-50 text-amber-600', icon: Clock },
          { label: 'Approved', value: stats.approved, color: 'text-blue-600', ring: 'bg-blue-50 text-blue-600', icon: CheckCircle },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-600', ring: 'bg-red-50 text-red-600', icon: XCircle },
          { label: 'Closed', value: stats.closed, color: 'text-slate-600', ring: 'bg-slate-100 text-slate-500', icon: AlertCircle },
        ].map((item) => (
          <div key={item.label} className="card p-4">
            <div className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${item.ring}`}>
              <item.icon className="h-4 w-4" />
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className={`mt-0.5 text-2xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md self-start">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-5 w-5" />
            </span>
            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value as TicketCategory | 'all'); setPage(1); }}
              className="input py-2 px-3 min-w-[150px]"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as TicketStatus | 'all'); setPage(1); }}
              className="input py-2 px-3 min-w-[150px]"
            >
              {STATUSES.map(st => (
                <option key={st.value} value={st.value}>{st.label}</option>
              ))}
            </select>
            <button onClick={() => { fetchTickets(); fetchStats(); }} className="btn-secondary">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500">
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3 hidden md:table-cell">Category</th>
                <th className="px-4 py-3 hidden lg:table-cell">Requester</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Priority</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
                      <span className="text-gray-500">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No tickets found
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                    <td className="px-4 py-4 text-sm font-mono text-gray-500">{ticket.ticket_number}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={getCategoryIcon(ticket.category).type === FileText ? 'text-blue-500' : 'text-gray-500'}>
                          {getCategoryIcon(ticket.category)}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-xs">{ticket.title}</p>
                          <p className="text-xs text-gray-500 truncate max-w-xs">{ticket.description.slice(0, 60)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="badge bg-gray-100 text-gray-700">{ticket.category}</span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <p className="text-sm text-gray-900">{ticket.requester?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{ticket.requester?.role}</p>
                    </td>
                    <td className="px-4 py-4">
                      {STATUS_ICONS[ticket.status]}
                      <span className={`badge ml-1 ${STATUSES.find(s => s.value === ticket.status)?.color || 'bg-gray-100 text-gray-700'}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {formatDistanceToNow(parseISO(ticket.updated_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-4">
                      <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary btn-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}