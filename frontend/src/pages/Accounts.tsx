import { useState, useEffect, FormEvent } from 'react';
import { api } from '../utils/api';
import { UserRole, AccountStatus } from '@envis/shared';
import { USER_ROLES } from '@envis/shared';
import {
  Search,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  RotateCcw,
  Pencil,
  X,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

export default function Accounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, active: 0, disabled: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showPassword, setShowPassword] = useState<Record<number, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    email: '',
    role: 'Extractor' as UserRole,
    division: '',
    status: 'Pending' as AccountStatus,
  });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: page.toString(), limit: '50' };
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (roleFilter !== 'all') params.role = roleFilter;
      if (divisionFilter) params.division = divisionFilter;

      const data = await api.get<{ accounts: any[]; total: number; page: number; limit: number }>('/accounts', params);
      setAccounts(data.accounts);
      setTotalPages(Math.ceil(data.total / 50));
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.get<any>('/accounts/stats');
      setStats(data);
      setDivisions(data.byDivision?.map((d: any) => d.division) || []);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchStats();
  }, [page, search, statusFilter, roleFilter, divisionFilter]);

  const handleAction = async (accountId: number, action: 'enable' | 'disable' | 'reset-password') => {
    setActionLoading(prev => ({ ...prev, [accountId]: action }));
    try {
      if (action === 'reset-password') {
        const result = await api.post<{ password: string }>(`/accounts/${accountId}/reset-password`);
        alert(`New password: ${result.password}\n\nThis is the only time it will be shown. Please copy it now.`);
      } else {
        await api.post(`/accounts/${accountId}/${action === 'enable' ? 'enable' : 'disable'}`);
        fetchAccounts();
        fetchStats();
      }
    } catch (error: any) {
      alert(error.data?.error || `Failed to ${action} account`);
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[accountId]; return n; });
    }
  };

  const handleBulkAction = async (action: 'enable' | 'disable' | 'reset-password') => {
    if (selectedAccounts.length === 0) return;
    setBulkActionLoading(true);
    try {
      const result = await api.post<{ results: any[] }>('/accounts/bulk-action', { accountIds: selectedAccounts, action });
      if (action === 'reset-password') {
        const passwords = result.results.filter(r => r.password).map(r => `ID ${r.id}: ${r.password}`).join('\n');
        alert(`Passwords reset:\n\n${passwords}\n\nThese are shown only once. Please copy them now.`);
      }
      fetchAccounts();
      fetchStats();
      setSelectedAccounts([]);
    } catch (error: any) {
      alert(error.data?.error || `Failed to ${action} accounts`);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const openEdit = (account: any) => {
    setEditing(account);
    setEditForm({
      full_name: account.full_name || '',
      username: account.username || '',
      email: account.email || '',
      role: account.role,
      division: account.division || '',
      status: account.status,
    });
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      await api.patch(`/accounts/${editing.id}`, editForm);
      setEditing(null);
      fetchAccounts();
      fetchStats();
    } catch (error: any) {
      alert(error.data?.error || 'Failed to update account');
    } finally {
      setSavingEdit(false);
    }
  };

  const getStatusColor = (status: AccountStatus) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-700';
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      case 'Active': return 'bg-blue-100 text-blue-700';
      case 'Disabled': return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Management</h1>
          <p className="text-gray-500 mt-1">View and manage all provisioned accounts</p>
        </div>
        <button onClick={() => { fetchAccounts(); fetchStats(); }} className="btn-secondary">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Approved</p>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Disabled</p>
          <p className="text-2xl font-bold text-gray-600">{stats.disabled}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Rejected</p>
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as AccountStatus | 'all'); setPage(1); }}
              className="input py-2 px-3 min-w-[140px]"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
              <option value="Rejected">Rejected</option>
            </select>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value as UserRole | 'all'); setPage(1); }}
              className="input py-2 px-3 min-w-[160px]"
            >
              <option value="all">All Roles</option>
              {USER_ROLES.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <select
              value={divisionFilter}
              onChange={(e) => { setDivisionFilter(e.target.value); setPage(1); }}
              className="input py-2 px-3 min-w-[200px]"
            >
              <option value="">All Divisions</option>
              {divisions.map(div => (
                <option key={div} value={div}>{div}</option>
              ))}
            </select>
          </div>
        </div>

        {(selectedAccounts.length > 0) && (
          <div className="px-4 py-3 bg-blue-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">{selectedAccounts.length} accounts selected</span>
            <div className="flex gap-2">
              <button onClick={() => handleBulkAction('enable')} disabled={bulkActionLoading} className="btn-success btn-sm">
                <Unlock className="w-3.5 h-3.5 mr-1" /> Enable
              </button>
              <button onClick={() => handleBulkAction('disable')} disabled={bulkActionLoading} className="btn-secondary btn-sm">
                <Lock className="w-3.5 h-3.5 mr-1" /> Disable
              </button>
              <button onClick={() => handleBulkAction('reset-password')} disabled={bulkActionLoading} className="btn-warning btn-sm">
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Password
              </button>
              <button onClick={() => setSelectedAccounts([])} className="btn-ghost btn-sm">Clear</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500">
                <th className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.length === accounts.length && accounts.length > 0}
                    onChange={(e) => e.target.checked ? setSelectedAccounts(accounts.map(a => a.id)) : setSelectedAccounts([])}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3 hidden md:table-cell">Ticket</th>
                <th className="px-4 py-3 hidden lg:table-cell">Role</th>
                <th className="px-4 py-3 hidden xl:table-cell">Division</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Created</th>
                <th className="px-4 py-3 w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                      <span className="text-gray-500">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">No accounts found</td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedAccounts.includes(account.id)}
                        onChange={(e) => e.target.checked
                          ? setSelectedAccounts(prev => [...prev, account.id])
                          : setSelectedAccounts(prev => prev.filter(id => id !== account.id))}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{account.full_name}</p>
                        <p className="text-sm text-gray-500 font-mono">@{account.username}</p>
                        <p className="text-sm text-gray-500">{account.email}</p>
                        {account.generated_password && showPassword[account.id] && (
                          <p className="mt-1 text-sm font-mono text-gray-900 bg-gray-100 rounded px-2 py-1 select-all break-all">
                            {account.generated_password}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      {account.ticket_number && (
                        <a href={`/tickets/${account.ticket_id}`} className="text-primary-600 hover:underline text-sm font-mono">
                          {account.ticket_number}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="badge bg-gray-100 text-gray-700">{account.role}</span>
                    </td>
                    <td className="px-4 py-4 hidden xl:table-cell">
                      <span className="text-sm text-gray-700">{account.division}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge ${getStatusColor(account.status)}`}>{account.status}</span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell text-sm text-gray-500">
                      {formatDistanceToNow(parseISO(account.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(account)}
                          disabled={bulkActionLoading}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
                          title="Edit account"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {account.generated_password && (
                          <button
                            onClick={() => setShowPassword(prev => ({ ...prev, [account.id]: !prev[account.id] }))}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                            title="Toggle password visibility"
                          >
                            {showPassword[account.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                        {account.status === 'Approved' || account.status === 'Active' ? (
                          <>
                            <button
                              onClick={() => handleAction(account.id, 'disable')}
                              disabled={Boolean(actionLoading[account.id]) || bulkActionLoading}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
                              title="Disable account"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAction(account.id, 'reset-password')}
                              disabled={Boolean(actionLoading[account.id]) || bulkActionLoading}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
                              title="Reset password"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </>
                        ) : account.status === 'Disabled' ? (
                          <button
                            onClick={() => handleAction(account.id, 'enable')}
                            disabled={Boolean(actionLoading[account.id]) || bulkActionLoading}
                            className="p-1.5 rounded hover:bg-gray-100 text-green-600 hover:text-green-700 disabled:opacity-50 transition-colors"
                            title="Enable account"
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                        ) : null}
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

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Account</h2>
                <p className="text-sm text-gray-500">
                  {editing.ticket_number ? `Ticket ${editing.ticket_number}` : 'Provisioned account'}
                </p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-4 px-6 py-5">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Username</label>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="input font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                    className="input"
                  >
                    {USER_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as AccountStatus })}
                    className="input"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Division</label>
                <input
                  type="text"
                  list="account-divisions"
                  value={editForm.division}
                  onChange={(e) => setEditForm({ ...editForm, division: e.target.value })}
                  className="input"
                  required
                />
                <datalist id="account-divisions">
                  {divisions.map((division) => (
                    <option key={division} value={division} />
                  ))}
                </datalist>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={savingEdit} className="btn-primary">
                  {savingEdit && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}