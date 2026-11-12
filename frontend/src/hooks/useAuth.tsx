import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../utils/api';
import { User, LoginRequest, LoginResponse, JWTPayload } from '@envis/shared';
import { ROLE_PERMISSIONS } from '@envis/shared';

interface AuthContextType {
  user: User | null;
  payload: JWTPayload | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  canApprove: () => boolean;
  canViewAll: () => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [payload, setPayload] = useState<JWTPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const storedPayload = localStorage.getItem('payload');
      const storedUser = localStorage.getItem('user');

      if (token && storedPayload && storedUser) {
        try {
          setPayload(JSON.parse(storedPayload));
          setUser(JSON.parse(storedUser));
        } catch {
          localStorage.clear();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    localStorage.setItem('accessToken', response.tokens.accessToken);
    localStorage.setItem('refreshToken', response.tokens.refreshToken);
    localStorage.setItem('payload', JSON.stringify({ userId: response.user.id, username: response.user.username, role: response.user.role }));
    localStorage.setItem('user', JSON.stringify(response.user));
    setPayload({ userId: response.user.id, username: response.user.username, role: response.user.role });
    setUser(response.user);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setPayload(null);
  };

  const refreshUser = async () => {
    const updated = await api.get<User>('/auth/me');
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  const hasPermission = (permission: string): boolean => {
    if (!payload) return false;
    return ROLE_PERMISSIONS[payload.role]?.includes(permission) ?? false;
  };

  const canApprove = (): boolean => hasPermission('approve');
  const canViewAll = (): boolean => hasPermission('view_all');

  return (
    <AuthContext.Provider value={{ user, payload, login, logout, refreshUser, isLoading, hasPermission, canApprove, canViewAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}