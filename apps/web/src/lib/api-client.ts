import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

let isRefreshing = false;
let refreshQueue: ((token: string | null) => void)[] = [];

const processQueue = (error: any, token: string | null = null) => {
  refreshQueue.forEach(cb => cb(token));
  refreshQueue = [];
};

export async function apiClient(path: string, options: RequestOptions = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});

  // Add authorization header if not skipped
  if (!options.skipAuth) {
    const token = Cookies.get('accessToken');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Set credentials to 'include' to ensure HTTP cookies are stored and sent
  options.credentials = 'include';
  options.headers = headers;

  try {
    const response = await fetch(url, options);

    if (response.status === 401 && !options.skipAuth && !path.includes('/api/v1/auth/refresh')) {
      // Access token expired, attempt to refresh
      if (isRefreshing) {
        // Wait for token refresh to complete
        return new Promise<string | null>((resolve) => {
          refreshQueue.push((token) => resolve(token));
        }).then(async (newToken) => {
          if (newToken) {
            headers.set('Authorization', `Bearer ${newToken}`);
            return fetch(url, options);
          } else {
            // Refresh failed, redirect to login
            Cookies.remove('accessToken');
            Cookies.remove('role');
            window.location.href = '/login';
            throw new Error('Unauthorized');
          }
        });
      }

      isRefreshing = true;

      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!refreshResponse.ok) {
          throw new Error('Refresh failed');
        }

        const data = await refreshResponse.json();
        const isProd = process.env.NODE_ENV === 'production';
        Cookies.set('accessToken', data.accessToken, { secure: isProd, sameSite: 'strict' });
        
        isRefreshing = false;
        processQueue(null, data.accessToken);

        // Retry the original request with new token
        headers.set('Authorization', `Bearer ${data.accessToken}`);
        return fetch(url, options);
      } catch (err) {
        isRefreshing = false;
        processQueue(err, null);
        Cookies.remove('accessToken');
        Cookies.remove('role');
        window.location.href = '/login';
        throw err;
      }
    }

    return response;
  } catch (err) {
    console.error('Request failed:', err);
    throw err;
  }
}
