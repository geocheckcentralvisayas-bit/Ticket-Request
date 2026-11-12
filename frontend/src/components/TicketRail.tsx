import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Ticket, TicketCategory, TICKET_CATEGORIES } from '@envis/shared';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Hash, Loader2, Plus, RefreshCw, Search, Ticket as TicketIcon } from 'lucide-react';

interface TicketRailProps {
  activeTicketId?: number;
  refreshKey?: string | number;
}

const STATUS_DOT: Record<string, string> = {
  Open: 'bg-green-500',
  'In Review': 'bg-yellow-500',
  Approved: 'bg-blue-500',
  Rejected: 'bg-red-500',
  Closed: 'bg-gray-400',
};

export default function TicketRail({ activeTicketId, refreshKey }: TicketRailProps) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<TicketCategory | 'all'>('all');

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (category !== 'all') params.category = category;
      if (search.trim()) params.search = search.trim();

      const [list, stats] = await Promise.all([
        api.get<{ tickets: Ticket[]; total: number }>('/tickets', params),
        api.get<{ total: number; byCategory?: { category: string; count: number }[] }>('/tickets/stats'),
      ]);

      setTickets(list.tickets);
      setTotal(list.total);

      const nextCounts: Record<string, number> = { all: stats.total };
      for (const item of stats.byCategory || []) {
        nextCounts[item.category] = item.count;
      }
      setCounts(nextCounts);
    } catch (error) {
      console.error('Failed to load ticket rail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [category, search, refreshKey]);

  const filteredTickets = useMemo(() => {
    if (category === 'all') return tickets;
    return tickets.filter(ticket => ticket.category === category);
  }, [tickets, category]);

  return (
    <aside className="hidden lg:flex w-72 flex-shrink-0 flex-col rounded-xl border border-gray-200 bg-white overflow-hidden sticky top-6 max-h-[calc(100vh-6rem)]">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Ticket Channels</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchTickets}
              className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Refresh tickets"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/tickets/new')}
              className="p-1.5 rounded-md text-primary-600 hover:bg-primary-50"
              title="Create ticket"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a ticket..."
            className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="px-2 pb-2 space-y-0.5">
        <button
          onClick={() => setCategory('all')}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
            category === 'all' ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Hash className="w-4 h-4 text-gray-400" />
          <span className="flex-1 text-left">all-tickets</span>
          <span className="text-xs text-gray-400">{counts.all ?? total}</span>
        </button>

        {TICKET_CATEGORIES.map((channel) => (
          <button
            key={channel.value}
            onClick={() => setCategory(channel.value)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
              category === channel.value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="w-4 text-center text-sm" aria-hidden="true">{channel.icon}</span>
            <span className="flex-1 text-left truncate">{channel.label}</span>
            <span className="text-xs text-gray-400">{counts[channel.value] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="mx-3 border-t border-gray-200" />

      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {category === 'all' ? 'All tickets' : category}
        </span>
        <span className="text-xs text-gray-400">{filteredTickets.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="px-2 py-8 text-center text-sm text-gray-500">
            <TicketIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            No tickets here yet.
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const isActive = ticket.id === activeTicketId;
            return (
              <button
                key={ticket.id}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className={`w-full text-left px-2.5 py-2 rounded-md mb-0.5 transition-colors ${
                  isActive ? 'bg-primary-50 border-l-2 border-primary-600' : 'border-l-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[ticket.status] || 'bg-gray-400'}`} />
                  <span className={`text-sm truncate ${isActive ? 'font-semibold text-primary-800' : 'font-medium text-gray-800'}`}>
                    {ticket.title}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5 pl-4">
                  <span className="text-[11px] font-mono text-gray-400 truncate">{ticket.ticket_number}</span>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">
                    {formatDistanceToNow(parseISO(ticket.updated_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 pl-4">
                  <span className="badge bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0">{ticket.status}</span>
                  {ticket.requester_name && (
                    <span className="text-[11px] text-gray-400 truncate">{ticket.requester_name}</span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
