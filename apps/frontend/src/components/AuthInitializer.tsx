'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useThemeStore } from '@/lib/themeStore';
import { setAuthToken } from '@/lib/api';

export function AuthInitializer() {
  const { login, setLoading } = useAuth();
  const { theme } = useThemeStore();

  // Initialize theme on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Initialize auth from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const savedAuth = localStorage.getItem('numatix-auth');
      if (savedAuth) {
        try {
          const parsed = JSON.parse(savedAuth);
          if (parsed.state?.token && parsed.state?.user) {
            login(parsed.state.token, parsed.state.user);
            setAuthToken(parsed.state.token);
          }
        } catch (e) {
          console.error('Failed to restore auth:', e);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, [login, setLoading]);

  return null;
}