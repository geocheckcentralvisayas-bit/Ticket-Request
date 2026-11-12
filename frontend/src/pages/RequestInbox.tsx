import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Search, RefreshCw, Loader2, Inbox } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

export default function RequestInbox() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total:0, new:0, in_review:0, contacted:0, approved:0, rejected:0, closed:0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params: Record<string,string> = { page: String(page), limit: '20' };
      if (search) params.search = search;
      if (status !== 'all') params.status = status;
      const [list, st] = await Promise.all([
        api.get<any>('/requests', params),
        api.get<any>('/requests/stats')
      ]);
      setItems(list.requests || []);
      setTotalPages(Math.max(1, Math.ceil((list.total || 0) / 20)));
      setStats(st);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [page, search, status]);

  const badge = (s: string) => {
    const map: Record<string,string> = { New:'bg-blue-100 text-blue-700', 'In Review':'bg-yellow-100 text-yellow-700', Contacted:'bg-purple-100 text-purple-700', Approved:'bg-green-100 text-green-700', Rejected:'bg-red-100 text-red-700', Closed:'bg-gray-100 text-gray-700' };
    return <span className={`badge ${map[s] || 'bg-gray-100 text-gray-700'}`}>{s}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Inbox className="w-7 h-7 text-primary-600" /> Access Request Inbox</h1>
          <p className="text-gray-500 mt-1">Receive and respond to access requests from users (web submissions). Reply by email from here.</p>
        </div>
        <button onClick={fetchAll} className="btn-secondary"><RefreshCw className="w-4 h-4 mr-2" />Refresh</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          ['Total', stats.total, 'text-gray-900'],
          ['New', stats.new, 'text-blue-600'],
          ['In Review', stats.in_review, 'text-yellow-600'],
          ['Contacted', stats.contacted, 'text-purple-600'],
          ['Approved', stats.approved, 'text-green-600'],
          ['Rejected', stats.rejected, 'text-red-600'],
          ['Closed', stats.closed, 'text-gray-600'],
        ].map(([label, val, cls]: any) => (
          <div key={label} className="card p-4"><p className="text-sm text-gray-500">{label}</p><p className={`text-2xl font-bold ${cls}`}>{val ?? 0}</p></div>
        ))}
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input className="input pl-10" placeholder="Search by ref, name, email, subject..." value={search} onChange={e=>{setSearch(e.target.value); setPage(1);}} />
          </div>
          <select className="input py-2 px-3 min-w-[170px]" value={status} onChange={e=>{setStatus(e.target.value); setPage(1);}}>
            <option value="all">All Statuses</option>
            <option value="New">New</option>
            <option value="In Review">In Review</option>
            <option value="Contacted">Contacted</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Type / Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><div className="flex items-center justify-center gap-2"><Loader2 className="w-6 h-6 animate-spin text-primary-600" /><span className="text-gray-500">Loading...</span></div></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No requests found</td></tr>
              ) : items.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/inbox/${r.id}`)}>
                  <td className="px-4 py-4 font-mono text-sm text-primary-700 font-medium">{r.ref_number}</td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-gray-900">{r.full_name}</p>
                    <p className="text-xs text-gray-500">{r.email}</p>
                    {r.division && <p className="text-xs text-gray-400">{r.division}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-gray-900 truncate max-w-xs">{r.subject}</p>
                    <p className="text-xs text-gray-500 truncate max-w-xs">{(r.message || '').slice(0, 80)}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    <div>{r.request_type || 'Access Request'}</div>
                    {r.requested_role && <div className="text-xs text-gray-500">{r.requested_role}</div>}
                  </td>
                  <td className="px-4 py-4">{badge(r.status)}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">{formatDistanceToNow(parseISO(r.created_at), { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="btn-secondary btn-sm">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="btn-secondary btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
