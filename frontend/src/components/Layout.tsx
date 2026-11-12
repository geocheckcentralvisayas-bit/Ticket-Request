import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  PlusCircle,
  Users,
  Mail,
  Settings,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
  Inbox,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: string;
}

const workspaceNav: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'New Ticket', href: '/tickets/new', icon: PlusCircle },
  { name: 'Inbox', href: '/inbox', icon: Inbox, permission: 'view_all' },
  { name: 'Email Outbox', href: '/emails', icon: Mail, permission: 'view_all' },
];

const adminNav: NavItem[] = [
  { name: 'Accounts', href: '/accounts', icon: Users, permission: 'manage_accounts' },
  { name: 'Users', href: '/users', icon: Shield, permission: 'manage_users' },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const filter = (items: NavItem[]) =>
    items.filter((item) => !item.permission || hasPermission(item.permission));

  const workspaceItems = filter(workspaceNav);
  const adminItems = filter(adminNav);

  const renderItem = (item: NavItem) => (
    <NavLink
      key={item.name}
      to={item.href}
      title={sidebarOpen ? undefined : item.name}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
        } ${!sidebarOpen ? 'justify-center' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary-400 transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden="true"
          />
          <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {sidebarOpen && <span className="truncate">{item.name}</span>}
        </>
      )}
    </NavLink>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} fixed z-40 flex h-screen flex-col border-r border-slate-800/80 bg-slate-900 transition-all duration-300`}
        aria-label="Main navigation"
      >
        <div className={`flex h-16 items-center border-b border-slate-800/80 px-4 ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white p-0.5 shadow-lg shadow-black/20 ring-1 ring-white/20">
                <img src="/denr-logo.svg" alt="DENR seal" className="h-full w-full object-contain" />
              </div>
              <div className="leading-tight">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-300">Region VII</p>
                <p className="text-base font-bold text-white">ENVIS</p>
              </div>
            </div>
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white p-0.5 shadow-lg shadow-black/20 ring-1 ring-white/20">
              <img src="/denr-logo.svg" alt="DENR seal" className="h-full w-full object-contain" />
            </div>
          )}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="mx-auto mt-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 scrollbar-thin" role="navigation">
          <div className="space-y-1">
            {sidebarOpen && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
            )}
            {workspaceItems.map(renderItem)}
          </div>

          {adminItems.length > 0 && (
            <div className="space-y-1">
              {sidebarOpen && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Administration</p>
              )}
              {adminItems.map(renderItem)}
            </div>
          )}
        </nav>

        <div className="border-t border-slate-800/80 p-3">
          <div className={`flex items-center gap-3 rounded-xl px-2 py-2 ${!sidebarOpen ? 'justify-center' : ''}`}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-800 text-sm font-semibold text-primary-200 ring-1 ring-white/10">
              {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{user?.full_name}</p>
                <p className="truncate text-xs text-slate-400">{user?.role}</p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            title={sidebarOpen ? undefined : 'Logout'}
            className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white ${
              !sidebarOpen ? 'justify-center' : ''
            }`}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`} style={{ minHeight: '100vh' }}>
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-6 lg:px-8">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Ticket Request &amp; Account Handler</p>
              <p className="truncate text-xs text-slate-500">DENR-EMB Region VII · ENVIS</p>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure session
            </span>
          </div>
        </header>

        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
