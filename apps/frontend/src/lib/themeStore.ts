// src/lib/themeStore.ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === 'light' ? 'dark' : 'light';
          // Apply class to <html>
          if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          return { theme: newTheme };
        }),
    }),
    {
      name: 'numatix-theme',
    }
  )
);

// Optional: Initialize on load
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('numatix-theme');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }
}