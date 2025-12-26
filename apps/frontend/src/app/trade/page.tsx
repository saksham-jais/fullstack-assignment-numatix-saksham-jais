// apps/frontend/src/app/trade/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Header from '@/components/Header';
import OrderEntryPanel from '@/components/OrderEntry';
import ChartPanel from '@/components/ChartPanel';
import PositionsTable from '@/components/PositionsTable';

export default function TradePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!user) return null; // Will redirect

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="container mx-auto px-4 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Portfolio</h1>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <OrderEntryPanel />
          </div>
          <div className="lg:col-span-8 space-y-6">
            <ChartPanel />
            <PositionsTable />
          </div>
        </div>
      </div>
    </div>
  );
}