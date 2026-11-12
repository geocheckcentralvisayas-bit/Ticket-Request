const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
  retried?: boolean;
}

class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, retried, ...fetchOptions } = options;

  const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const token = localStorage.getItem('accessToken');
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const response = await fetch(url.toString(), {
    ...fetchOptions,
    headers: defaultHeaders,
  });

  const isAuthEndpoint = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/refresh');

  if (response.status === 401 && !isAuthEndpoint && !retried) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      const refreshResponse = await fetch(new URL(`${API_BASE}/auth/refresh`, window.location.origin).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshResponse.ok) {
        const { accessToken, refreshToken: newRefreshToken } = await refreshResponse.json();
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        return request(endpoint, { ...options, retried: true });
      }
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('payload');
    localStorage.removeItem('user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const fieldError = data?.details?.fieldErrors
      ? Object.values(data.details.fieldErrors).flat().find(Boolean)
      : undefined;
    throw new ApiError(response.status, data.error || (fieldError as string) || 'Request failed', data);
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string>) => request<T>(endpoint, { method: 'GET', params }),
  post: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export { ApiError };
