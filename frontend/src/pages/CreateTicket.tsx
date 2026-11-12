import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { CreateTicketRequest, CreateTicketAccountRequest, TicketCategory, UserRole } from '@envis/shared';
import {
  ArrowLeft,
  Plus,
  Trash2,
  User,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { USER_ROLES } from '@envis/shared';

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'New Account', label: 'New Account' },
  { value: 'Access Change', label: 'Access Change' },
  { value: 'Reset', label: 'Reset' },
  { value: 'Deactivation', label: 'Deactivation' },
  { value: 'Issue', label: 'Issue' },
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

const emptyAccount = (): CreateTicketAccountRequest => ({
  username: '',
  email: '',
  full_name: '',
  role: 'Extractor',
  division: '',
});

export default function CreateTicket() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CreateTicketRequest>({
    title: '',
    description: '',
    category: 'New Account',
    priority: 'Medium',
    accounts: [emptyAccount()],
  });
  const [errors, setErrors] = useState<Partial<CreateTicketRequest>>({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [usernameTouched, setUsernameTouched] = useState<Record<number, boolean>>({});

  const updateField = (field: keyof CreateTicketRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
    setGeneralError('');
  };

  const updateAccount = (index: number, field: keyof CreateTicketAccountRequest, value: any) => {
    if (field === 'username') {
      setUsernameTouched(prev => ({ ...prev, [index]: true }));
    }
    setFormData(prev => {
      const newAccounts = [...prev.accounts];
      newAccounts[index] = { ...newAccounts[index], [field]: value };
      return { ...prev, accounts: newAccounts };
    });
    setErrors(prev => {
      const newErrors = { ...prev };
      if (newErrors.accounts && newErrors.accounts[index]) {
        delete newErrors.accounts[index];
      }
      return newErrors;
    });
  };

  const addAccount = () => {
    setFormData(prev => ({ ...prev, accounts: [...prev.accounts, emptyAccount()] }));
  };

  const removeAccount = (index: number) => {
    if (formData.accounts.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      accounts: prev.accounts.filter((_, i) => i !== index),
    }));
    setUsernameTouched({});
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<CreateTicketRequest> = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.category) newErrors.category = 'Category is required' as any;

    const accountErrors = formData.accounts.map((acc) => {
      const err: Partial<CreateTicketAccountRequest> = {};
      if (!acc.username.trim()) err.username = 'Username is required';
      if (!acc.email.trim()) err.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acc.email)) err.email = 'Invalid email format';
      if (!acc.full_name.trim()) err.full_name = 'Full name is required';
      if (!acc.role) err.role = 'Role is required' as any;
      if (!acc.division.trim()) err.division = 'Division is required';
      return Object.keys(err).length > 0 ? err : null;
    }).filter(Boolean);

    if (accountErrors.length > 0) {
      newErrors.accounts = accountErrors as any;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setGeneralError('');

    try {
      await api.post('/tickets', formData);
      navigate('/dashboard');
    } catch (err: any) {
      setGeneralError(err.data?.error || err.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const generateUsername = (fullName: string) => {
    const parts = fullName.toLowerCase().trim().split(/\s+/);
    const firstName = parts[0] || 'user';
    const lastName = parts[parts.length - 1] || '';
    const base = lastName ? `${firstName}.${lastName}` : firstName;
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${base}${random}`.replace(/[^a-z0-9.]/g, '').slice(0, 20);
  };

  const handleFullNameChange = (index: number, fullName: string) => {
    updateAccount(index, 'full_name', fullName);
    if (!usernameTouched[index]) {
      setFormData(prev => {
        const accounts = [...prev.accounts];
        accounts[index] = { ...accounts[index], username: fullName.trim() ? generateUsername(fullName) : '' };
        return { ...prev, accounts };
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/dashboard')} className="btn-secondary p-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Ticket</h1>
          <p className="text-gray-500">Submit a new account request or issue</p>
        </div>
      </div>

      {generalError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700" role="alert">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{generalError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="title" className="label">Title *</label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              className={`input ${errors.title ? 'border-red-300 focus:ring-red-500' : ''}`}
              placeholder="Brief description of the request"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>
          <div>
            <label htmlFor="category" className="label">Category *</label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => updateField('category', e.target.value as TicketCategory)}
              className={`input ${errors.category ? 'border-red-300 focus:ring-red-500' : ''}`}
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
          </div>
          <div>
            <label htmlFor="priority" className="label">Priority *</label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => updateField('priority', e.target.value as any)}
              className={`input ${errors.priority ? 'border-red-300 focus:ring-red-500' : ''}`}
            >
              {PRIORITIES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="label">Description *</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={4}
            className={`input ${errors.description ? 'border-red-300 focus:ring-red-500' : ''}`}
            placeholder="Detailed description of the request..."
          />
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5" />
              Accounts to Create ({formData.accounts.length})
            </h3>
            <button type="button" onClick={addAccount} className="btn-secondary btn-sm">
              <Plus className="w-4 h-4 mr-1" /> Add Account
            </button>
          </div>

          <div className="space-y-4">
            {formData.accounts.map((account, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">Account #{index + 1}</h4>
                  {formData.accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAccount(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Full Name *</label>
                    <input
                      type="text"
                      value={account.full_name}
                      onChange={(e) => handleFullNameChange(index, e.target.value)}
                      className={`input ${errors.accounts?.[index]?.full_name ? 'border-red-300 focus:ring-red-500' : ''}`}
                      placeholder="Juan Dela Cruz"
                    />
                    {errors.accounts?.[index]?.full_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.accounts[index].full_name}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Username *</label>
                    <input
                      type="text"
                      value={account.username}
                      onChange={(e) => updateAccount(index, 'username', e.target.value)}
                      className={`input ${errors.accounts?.[index]?.username ? 'border-red-300 focus:ring-red-500' : ''}`}
                      placeholder="juan.dela.cruz001"
                    />
                    {errors.accounts?.[index]?.username && (
                      <p className="mt-1 text-sm text-red-600">{errors.accounts[index].username}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Email *</label>
                    <input
                      type="email"
                      value={account.email}
                      onChange={(e) => updateAccount(index, 'email', e.target.value)}
                      className={`input ${errors.accounts?.[index]?.email ? 'border-red-300 focus:ring-red-500' : ''}`}
                      placeholder="juan.dela.cruz@envis.gov.ph"
                    />
                    {errors.accounts?.[index]?.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.accounts[index].email}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Role *</label>
                    <select
                      value={account.role}
                      onChange={(e) => updateAccount(index, 'role', e.target.value as UserRole)}
                      className={`input ${errors.accounts?.[index]?.role ? 'border-red-300 focus:ring-red-500' : ''}`}
                    >
                      {USER_ROLES.map(role => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                    {errors.accounts?.[index]?.role && (
                      <p className="mt-1 text-sm text-red-600">{errors.accounts[index].role}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Division *</label>
                    <input
                      type="text"
                      value={account.division}
                      onChange={(e) => updateAccount(index, 'division', e.target.value)}
                      className={`input ${errors.accounts?.[index]?.division ? 'border-red-300 focus:ring-red-500' : ''}`}
                      placeholder="Environmental Management Division"
                    />
                    {errors.accounts?.[index]?.division && (
                      <p className="mt-1 text-sm text-red-600">{errors.accounts[index].division}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Create Ticket
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}