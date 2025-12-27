// Updated src/lib/api.ts (ensure baseURL is env-aware; add timeout)
import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || 'https://fullstack-assignment-numatix-saksha-self.vercel.app/api',
  timeout: 10000, // 10s timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Store token globally
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Request interceptor (redundant with defaults, but explicit)
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setAuthToken(null);
      // Optional redirect in components
    }
    return Promise.reject(error);
  }
);

// API functions
export const placeOrder = async (order: {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  quantity: number;
  price?: number;
}) => {
  const response = await api.post('/trading/orders', order);
  return response.data;
};

export const login = async (credentials: { email: string; password: string }) => {
  const response = await api.post('/auth/login', credentials);
  const { token } = response.data;
  if (token) setAuthToken(token); // Auto-set
  return response.data;
};

export const register = async (data: { email: string; password: string; binanceApiKey: string; binanceSecretKey: string }) => {
  const response = await api.post('/auth/register', data);
  const { token } = response.data;
  if (token) setAuthToken(token); // Auto-set
  return response.data;
};

export default api;