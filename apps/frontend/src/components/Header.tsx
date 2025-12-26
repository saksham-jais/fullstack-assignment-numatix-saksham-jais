'use client';

import { useAuth } from '@/lib/auth';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useThemeStore } from '@/lib/themeStore';
import SearchBar from './SearchBar';
import { setAuthToken } from '@/lib/api'; // Import to clear token

export default function Header() {
  const { user, logout: authLogout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useThemeStore();
  const router = useRouter();

  // Apply theme class to <html> on mount and change
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Handle logout: clear auth, token, and redirect
  const handleLogout = () => {
    authLogout();                    // Clear Zustand auth state
    setAuthToken(null);              // Clear Axios token
    localStorage.removeItem('token'); // Optional: clean up storage
    router.push('/login');
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4 sticky top-0 z-50 shadow-sm">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-6">
        {/* Logo + Brand */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
            N
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white hidden sm:block">
            Numatix
          </h1>
        </div>

        {/* Search Bar - Desktop */}
        <div className="hidden lg:block flex-1 max-w-xl">
          <SearchBar />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {/* Live Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-green-600 font-medium">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm">Live</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-yellow-400" />
            ) : (
              <Moon className="w-5 h-5 text-gray-700" />
            )}
          </button>

          {/* User Info & Logout - Desktop */}
          <div className="hidden sm:flex items-center gap-4 text-sm">
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              {user?.email || 'guest@numatix.io'}
            </span>
            <button
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700 font-medium transition"
            >
              Logout
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
          {/* Mobile Search */}
          <div className="px-2">
            <SearchBar />
          </div>

          {/* Live Status */}
          <div className="flex items-center gap-2 text-green-600 font-medium px-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span>Live Trading</span>
          </div>

          {/* User & Logout */}
          <div className="px-4 space-y-3">
            <div className="text-gray-700 dark:text-gray-300 font-medium">
              {user?.email || 'guest@numatix.io'}
            </div>
            <button
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              className="text-left text-red-600 hover:text-red-700 font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}