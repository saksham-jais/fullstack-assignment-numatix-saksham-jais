'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register as apiRegister } from '@/lib/api';
import { setAuthToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login: authLogin, setLoading: setAuthLoading } = useAuth(); // Add setAuthLoading
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !apiKey || !secretKey) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError(null);
    setAuthLoading(true); // Sync loading

    try {
      const response = await apiRegister({
        email: email.trim(),
        password,
        binanceApiKey: apiKey.trim(),
        binanceSecretKey: secretKey.trim(),
      });

      const { token, user } = response;

      if (!token || !user) {
        throw new Error('Invalid response from server');
      }

      authLogin(token, user);
      setAuthToken(token);

      router.push('/trade');
    } catch (err: any) {
      console.error('Registration failed:', err);
      const message =
        err.response?.data?.error ||
        err.message ||
        'Registration failed. Please check your details and try again.';
      setError(message);
    } finally {
      setLoading(false);
      setAuthLoading(false); // Reset
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-green-500 to-emerald-600"></div>

          <div className="p-8 lg:p-10">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-4">
                <span className="text-3xl font-bold text-white">N</span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Create Account</h1>
              <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
                Connect your Binance Testnet keys securely
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-4 focus:ring-green-500/30 focus:border-green-500 outline-none"
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-4 pr-14 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-4 focus:ring-green-500/30 focus:border-green-500 outline-none"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Binance Testnet API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-4 focus:ring-green-500/30 focus:border-green-500 outline-none"
                  placeholder="From testnet.binance.vision"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Binance Testnet Secret Key
                </label>
                <input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-4 focus:ring-green-500/30 focus:border-green-500 outline-none"
                  required
                  disabled={loading}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Your keys are encrypted and never exposed
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-8 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-lg font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-60 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating Account...
                  </>
                ) : (
                  'Register & Start Trading'
                )}
              </button>
            </form>

            <div className="mt-10 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Already registered?{' '}
                <a href="/login" className="font-bold text-green-600 dark:text-green-400 hover:underline">
                  Sign in
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