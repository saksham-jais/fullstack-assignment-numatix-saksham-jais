'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { login as apiLogin } from '@/lib/api';
import { setAuthToken } from '@/lib/api';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login: authLogin, setLoading: setAuthLoading } = useAuth(); // Add setAuthLoading
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError(null);
    setAuthLoading(true); // Sync loading

    try {
      const response = await apiLogin({ email: email.trim(), password });

      const { token, user } = response;

      if (!token || !user) {
        throw new Error('Invalid response from server');
      }

      // Save auth state (persists to localStorage)
      authLogin(token, user);

      // Set token for API calls
      setAuthToken(token);

      // Redirect
      router.push('/trade');
    } catch (err: any) {
      console.error('Login failed:', err);
      const message =
        err.response?.data?.error ||
        err.message ||
        'Invalid email or password. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
      setAuthLoading(false); // Reset loading
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-600 to-purple-600"></div>

          <div className="p-8 lg:p-10">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4">
                <span className="text-3xl font-bold text-white">N</span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Welcome Back</h1>
              <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
                Sign in to your Numatix account
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-4 pr-14 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-10 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Don't have an account?{' '}
                <a href="/register" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
                  Register here
                </a>
              </p>
            </div>

            <p className="mt-12 text-center text-xs text-gray-500 dark:text-gray-400">
              Testnet only • No real funds at risk
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}