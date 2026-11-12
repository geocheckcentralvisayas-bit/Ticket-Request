import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { ROLE_PERMISSIONS } from '@envis/shared';
import {
  User as UserIcon,
  Lock,
  Bell,
  Database,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function Settings() {
  const { user, payload, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'notifications' | 'system'>('profile');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile
  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
  });

  // Password
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  // Notifications
  const [notifications, setNotifications] = useState({
    emailOnTicketUpdate: true,
    emailOnAssignment: true,
    emailOnMention: true,
    inAppNotifications: true,
  });

  useEffect(() => {
    if (user) {
      setProfileData({ full_name: user.full_name, email: user.email });
    }
  }, [user?.id, user?.full_name, user?.email]);

  useEffect(() => {
    if (user?.notification_prefs) {
      try {
        setNotifications(prev => ({ ...prev, ...JSON.parse(user.notification_prefs!) }));
      } catch {
        // Ignore malformed saved preferences and keep defaults.
      }
    }
  }, [user?.notification_prefs]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.patch('/auth/profile', profileData);
      await refreshUser();
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.data?.error || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: 'Password changed successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.data?.error || 'Failed to change password' });
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.patch('/auth/profile', { notification_prefs: JSON.stringify(notifications) });
      await refreshUser();
      setMessage({ type: 'success', text: 'Notification preferences saved' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.data?.error || 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'system', label: 'System', icon: Database },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex flex-wrap -mb-px" aria-label="Settings tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <tab.icon className="w-4 h-4 mr-2 inline" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`} role="alert">
              {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <p>{message.text}</p>
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSave} className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="full_name" className="label">Full Name</label>
                  <input
                    id="full_name"
                    type="text"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="label">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  <strong>Role:</strong> {user?.role} | <strong>Division:</strong> {user?.division}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  <strong>User ID:</strong> {user?.id} | <strong>Username:</strong> {user?.username}
                </p>
              </div>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Changes
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSave} className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="label">Current Password</label>
                  <div className="relative">
                    <input
                      id="currentPassword"
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="newPassword" className="label">New Password</label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="input pr-10"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="label">Confirm New Password</label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Change Password
              </button>
            </form>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
              <div className="space-y-4">
                {[
                  { key: 'emailOnTicketUpdate', label: 'Email on ticket status updates', description: 'Receive email when tickets you created or are assigned to change status' },
                  { key: 'emailOnAssignment', label: 'Email on ticket assignment', description: 'Receive email when a ticket is assigned to you' },
                  { key: 'emailOnMention', label: 'Email on mentions', description: 'Receive email when you are mentioned in a ticket conversation' },
                  { key: 'inAppNotifications', label: 'In-app notifications', description: 'Show notification badge in the application' },
                ].map((item) => (
                  <label key={item.key} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifications[item.key as keyof typeof notifications]}
                      onChange={(e) => setNotifications(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      className="mt-1 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <button onClick={handleNotificationSave} className="btn-primary" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Preferences
              </button>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">System &amp; Security</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Application</p>
                  <p className="font-mono text-lg text-gray-900">ENVIS Ticket Manager</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Session</p>
                  <p className="font-mono text-lg text-gray-900">Encrypted · 15 min</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Credential storage</p>
                  <p className="font-mono text-lg text-gray-900">Hashed (bcrypt)</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Transport</p>
                  <p className="font-mono text-lg text-gray-900">TLS / SMTP</p>
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h4 className="font-medium text-emerald-900 mb-1">Security reminders</h4>
                <ul className="list-disc list-inside text-sm text-emerald-800 space-y-1">
                  <li>Never share your password or paste credentials into shared documents.</li>
                  <li>Sign out when leaving a shared workstation.</li>
                  <li>Report suspicious sign-in activity to the MIS unit immediately.</li>
                </ul>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Your Permissions</h4>
                <div className="flex flex-wrap gap-2">
                  {payload && (ROLE_PERMISSIONS[payload.role] || []).map(perm => (
                    <span key={perm} className="badge bg-primary-100 text-primary-700">{perm}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}