import axios from 'axios';

const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(window.location.origin);

export const API_BASE_URL = isLocalhost 
  ? `http://${window.location.hostname}:5000`
  : (configuredApiUrl || (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000'));

const axiosClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }

  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const storedToken = localStorage.getItem('token');

    // A restarted backend, rotated JWT secret, or expired JWT can leave the
    // interface looking logged in while every protected API call fails.
    // Clear the stale session once and notify AuthProvider so every protected
    // screen returns to the login page consistently.
    if (status === 401 && storedToken) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:session-expired'));
    }

    return Promise.reject(error);
  },
);

export function resolveFileUrl(url) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${API_BASE_URL}${url}`;
}

export default axiosClient;
