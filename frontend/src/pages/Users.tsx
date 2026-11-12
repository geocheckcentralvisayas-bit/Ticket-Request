import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { UserRole } from '@envis/shared';
import { USER_ROLES } from '@envis/shared';
import {
  Search,
  RefreshCw,
  Loader2,
  Edit,
  Trash2,
  Lock,
  Unlock,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'Extractor' as UserRole,
    division: '',
    is_active: true,
  });
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: page.toString(), limit: '50' };
      if (search) params.search = search;
      if (roleFilter !== 'all') params.role = roleFilter;
      if (statusFilter !== 'all') params.is_active = statusFilter === 'active' ? 'true' : 'false';

      const data = await api.get<{ users: any[]; total: number; page: number; limit: number }>('/users', params);
      setUsers(data.users);
      setTotalPages(Math.ceil(data.total / 50));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search, roleFilter, statusFilter]);

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      division: user.division,
      is_active: user.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSubmitting(true);
    try {
      await api.patch(`/users/${editingUser.id}`, formData);
      closeModal();
      fetchUsers();
    } catch (error: any) {
      alert(error.data?.error || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (userId: number, action: 'reset-password' | 'generate-password' | 'toggle-active') => {
    setActionLoading(prev => ({ ...prev, [userId]: action }));
    try {
      if (action === 'reset-password') {
        const newPassword = prompt('Enter new password (min 8 chars):');
        if (!newPassword || newPassword.length < 8) return;
        await api.post(`/users/${userId}/reset-password`, { newPassword });
        alert('Password reset successfully');
      } else if (action === 'generate-password') {
        const result = await api.post<{ password: string }>(`/users/${userId}/generate-password`);
        alert(`New password: ${result.password}\n\nThis is the only time it will be shown. Please copy it now.`);
      } else if (action === 'toggle-active') {
        const user = users.find(u => u.id === userId);
        await api.patch(`/users/${userId}`, { is_active: !user?.is_active });
        fetchUsers();
      }
    } catch (error: any) {
      alert(error.data?.error || `Failed to ${action}`);
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[userId]; return n; });
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      await api.delete(`/users/${userId}`);
      fetchUsers();
    } catch (error: any) {
      alert(error.data?.error || 'Failed to delete user');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      'Admin': 'bg-purple-100 text-purple-700',
      'Regional Director': 'bg-red-100 text-red-700',
      'EMED': 'bg-blue-100 text-blue-700',
      'CPD': 'bg-green-100 text-green-700',
      'MIS': 'bg-indigo-100 text-indigo-700',
      'Extractor': 'bg-gray-100 text-gray-700',
      'GIS': 'bg-teal-100 text-teal-700',
    };
    return <span className={`badge ${colors[role] || 'bg-gray-100 text-gray-700'}`}>{role}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Manage system users and permissions</p>
        </div>
        <button onClick={fetchUsers} className="btn-secondary">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
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
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
              className="input py-2 px-3 min-w-[140px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3 hidden md:table-cell">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 hidden lg:table-cell">Division</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Created</th>
                <th className="px-4 py-3 w-48">Actions</th>
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
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">No users found</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">{user.full_name?.charAt(0) || 'U'}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-xs text-gray-500 font-mono">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell text-sm text-gray-700">{user.email}</td>
                    <td className="px-4 py-4">{getRoleBadge(user.role)}</td>
                    <td className="px-4 py-4 hidden lg:table-cell text-sm text-gray-700">{user.division}</td>
                    <td className="px-4 py-4">
                      <span className={`badge ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell text-sm text-gray-500">
                      {formatDistanceToNow(parseISO(user.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                          title="Edit user"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAction(user.id, 'toggle-active')}
                          disabled={Boolean(actionLoading[user.id])}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {user.is_active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleAction(user.id, 'generate-password')}
                          disabled={Boolean(actionLoading[user.id])}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
                          title="Generate new password"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAction(user.id, 'reset-password')}
                          disabled={Boolean(actionLoading[user.id])}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
                          title="Set custom password"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-1.5 rounded hover:bg-gray-100 text-red-500 hover:text-red-700 transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  className="input"
                >
                  {USER_ROLES.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Division</label>
                <input
                  type="text"
                  value={formData.division}
                  onChange={(e) => setFormData(prev => ({ ...prev, division: e.target.value }))}
                  className="input"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}