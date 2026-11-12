import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TicketDetail from './pages/TicketDetail';
import CreateTicket from './pages/CreateTicket';
import Accounts from './pages/Accounts';
import EmailOutbox from './pages/EmailOutbox';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import RequestAccess from './pages/RequestAccess';
import RequestInbox from './pages/RequestInbox';
import RequestDetail from './pages/RequestDetail';

function PrivateRoute({ children, requiredPermission }: { children: React.ReactNode; requiredPermission?: string }) {
  const { user, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/request-access" element={<RequestAccess />} />
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tickets/new" element={<CreateTicket />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route
          path="/inbox"
          element={
            <PrivateRoute requiredPermission="view_all">
              <RequestInbox />
            </PrivateRoute>
          }
        />
        <Route
          path="/inbox/:id"
          element={
            <PrivateRoute requiredPermission="view_all">
              <RequestDetail />
            </PrivateRoute>
          }
        />
        <Route
          path="/accounts"
          element={
            <PrivateRoute requiredPermission="manage_accounts">
              <Accounts />
            </PrivateRoute>
          }
        />
        <Route
          path="/emails"
          element={
            <PrivateRoute requiredPermission="view_all">
              <EmailOutbox />
            </PrivateRoute>
          }
        />
        <Route
          path="/users"
          element={
            <PrivateRoute requiredPermission="manage_users">
              <Users />
            </PrivateRoute>
          }
        />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}