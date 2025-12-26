'use client';

import Header from '@/components/Header';
import OrderEntryPanel from '@/components/OrderEntry';
import ChartPanel from '@/components/ChartPanel';
import PositionsTable from '@/components/PositionsTable';

export default function TradeLayout() {
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