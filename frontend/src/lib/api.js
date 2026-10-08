import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  // A header set on the call wins: that is how the select_token is sent.
  const token = localStorage.getItem('auth_token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const NO_REDIRECT_PAGES = ['/login', '/legal', '/privacy'];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthCall = /\/auth\/(login|register|forgot-password)/.test(url);
    if (status === 401 && !isAuthCall) {
      localStorage.removeItem('auth_token');
      if (!NO_REDIRECT_PAGES.includes(window.location.pathname)) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
