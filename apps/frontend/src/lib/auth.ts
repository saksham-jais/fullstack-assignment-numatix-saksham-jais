'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAuthToken } from './api'; // Sync with axios

interface AuthState {
  token: string | null;
  user: { id: string; email: string } | null;
  loading: boolean;
  login: (token: string, user: { id: string; email: string }) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: true,
      login: (token, user) => {
        console.log('Persisting token to store/localStorage:', token ? token.substring(0, 20) + '...' : 'null'); // Debug
        setAuthToken(token); // Sync axios
        set({ token, user, loading: false });
      },
      logout: () => {
        setAuthToken(null);
        set({ token: null, user: null, loading: false });
      },
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'numatix-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

export const getToken = () => useAuth.getState().token;