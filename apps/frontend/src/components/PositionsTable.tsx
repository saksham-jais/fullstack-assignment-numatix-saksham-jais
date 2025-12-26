'use client';

import { useEffect, useCallback, useState } from 'react';
import { Tab } from '@headlessui/react';
import clsx from 'clsx';
import { PencilIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useTradeStore } from '@/lib/tradeStore';

type TabType = 'Positions' | 'Orders' | 'Trades';

export default function TradingPanel() {
  const { positions, orders, fetchPositions, fetchOrders } = useTradeStore();
  const [loading, setLoading] = useState<Record<TabType, boolean>>({
    Positions: false,
    Orders: false,
    Trades: false,
  });
  const [error, setError] = useState<Record<TabType, string | null>>({
    Positions: null,
    Orders: null,
    Trades: null,
  });

  const loadData = useCallback(async (tab: TabType) => {
    setLoading((prev) => ({ ...prev, [tab]: true }));
    setError((prev) => ({ ...prev, [tab]: null }));
    try {
      if (tab === 'Positions') {
        await fetchPositions();
      } else if (tab === 'Orders') {
        await fetchOrders();
      }
      // Trades derived from orders, no fetch needed
    } catch (err: any) {
      console.error(`Failed to load ${tab}:`, err);
      setError((prev) => ({ ...prev, [tab]: err.message || 'Failed to load data' }));
    } finally {
      setLoading((prev) => ({ ...prev, [tab]: false }));
    }
  }, [fetchPositions, fetchOrders]);

  // Fetch on mount
  useEffect(() => {
    loadData('Positions');
    loadData('Orders');
  }, [loadData]);

  // Refetch when tab comes into view
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        loadData('Positions');
        loadData('Orders');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadData]);

  // Dynamic polling: Refetch every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData('Positions');
      loadData('Orders');
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [loadData]);

  // Manual refresh handler
  const handleRefresh = useCallback((tab: TabType) => {
    loadData(tab);
  }, [loadData]);

  // Compute trades from filled orders (for Trades tab)
  const trades = orders
    .filter((order) => order.status === 'FILLED')
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

  const renderTable = (tab: TabType) => {
    const isLoading = loading[tab];
    const err = error[tab];
    const dataLength = tab === 'Trades' ? trades.length : tab === 'Positions' ? positions.length : orders.length;

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      );
    }

    if (err) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mb-4" />
          <div className="text-red-600 dark:text-red-400 mb-2">{err}</div>
          <button
            onClick={() => handleRefresh(tab)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Retry
          </button>
        </div>
      );
    }

    if (dataLength === 0) {
      const messages = {
        Positions: 'No open positions',
        Orders: 'No orders yet',
        Trades: 'Trade history will appear here after orders are filled',
      };
      return (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {messages[tab]}
        </div>
      );
    }

    // Render specific table based on tab
    if (tab === 'Positions') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="pb-4 w-12"></th>
                <th className="pb-4">Transaction</th>
                <th className="pb-4 text-right">Size</th>
                <th className="pb-4 text-right">Entry price</th>
                <th className="pb-4 text-right">Market price</th>
                <th className="pb-4 text-right">Realized PnL</th>
                <th className="pb-4 text-right">Unrealized PnL</th>
                <th className="pb-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const isLong = pos.size > 0;
                const unrealized = pos.unrealizedPnL || 0;
                const unrealizedPct = pos.unrealizedPnLPercent || 0;

                return (
                  <tr
                    key={pos.symbol}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="py-4">
                      <div
                        className={clsx(
                          'w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-lg',
                          isLong ? 'bg-green-500' : 'bg-red-500'
                        )}
                      >
                        {isLong ? '↑' : '↓'}
                      </div>
                    </td>
                    <td className="py-4 font-medium text-gray-900 dark:text-white">
                      {pos.symbol.replace('USDT', '/USDT')}
                    </td>
                    <td className="py-4 text-right text-gray-700 dark:text-gray-300">
                      {Math.abs(pos.size).toFixed(6)}
                    </td>
                    <td className="py-4 text-right text-gray-700 dark:text-gray-300">
                      ${pos.entryPrice.toFixed(2)}
                    </td>
                    <td className="py-4 text-right text-gray-700 dark:text-gray-300">
                      ${pos.markPrice.toFixed(2)}
                    </td>
                    <td className={clsx('py-4 text-right font-medium', unrealized >= 0 ? 'text-green-600' : 'text-red-600')}>
                      —
                    </td>
                    <td className={clsx('py-4 text-right font-medium', unrealized >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {unrealized >= 0 ? '+' : ''}{unrealized.toFixed(2)} (
                      {unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%)
                    </td>
                    <td className="py-4 text-right">
                      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <PencilIcon className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (tab === 'Orders') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="pb-4">Time</th>
                <th className="pb-4">Symbol</th>
                <th className="pb-4">Side</th>
                <th className="pb-4">Type</th>
                <th className="pb-4 text-right">Quantity</th>
                <th className="pb-4 text-right">Price</th>
                <th className="pb-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.orderId} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-4">
                    {order.timestamp ? new Date(order.timestamp).toLocaleString() : '-'}
                  </td>
                  <td className="py-4">{order.symbol}</td>
                  <td className={clsx('py-4 font-medium', order.side === 'BUY' ? 'text-green-600' : 'text-red-600')}>
                    {order.side}
                  </td>
                  <td className="py-4">{order.type}</td>
                  <td className="py-4 text-right">{order.quantity.toFixed(6)}</td>
                  <td className="py-4 text-right">
                    {order.price ? `$${order.price.toFixed(2)}` : '-'}
                  </td>
                  <td className="py-4">
                    <span
                      className={clsx(
                        'px-3 py-1 rounded-full text-xs font-medium',
                        order.status === 'FILLED'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : order.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (tab === 'Trades') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="pb-4">Time</th>
                <th className="pb-4">Symbol</th>
                <th className="pb-4">Side</th>
                <th className="pb-4 text-right">Quantity</th>
                <th className="pb-4 text-right">Price</th>
                <th className="pb-4 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.orderId} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-4">
                    {trade.timestamp ? new Date(trade.timestamp).toLocaleString() : '-'}
                  </td>
                  <td className="py-4">{trade.symbol}</td>
                  <td className={clsx('py-4 font-medium', trade.side === 'BUY' ? 'text-green-600' : 'text-red-600')}>
                    {trade.side}
                  </td>
                  <td className="py-4 text-right">{trade.quantity.toFixed(6)}</td>
                  <td className="py-4 text-right">
                    {trade.price ? `$${trade.price.toFixed(2)}` : '-'}
                  </td>
                  <td className="py-4 text-right text-gray-700 dark:text-gray-300">
                    ${((trade.quantity || 0) * (trade.price || 0)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Portfolio</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRefresh('Positions')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh Positions"
            disabled={loading.Positions}
          >
            <ArrowPathIcon className={clsx("w-5 h-5", loading.Positions && "animate-spin")} />
          </button>
          <button
            onClick={() => handleRefresh('Orders')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh Orders"
            disabled={loading.Orders}
          >
            <ArrowPathIcon className={clsx("w-5 h-5", loading.Orders && "animate-spin")} />
          </button>
        </div>
      </div>
      <Tab.Group>
        <Tab.List className="flex border-b border-gray-100 dark:border-gray-700">
          {(['Positions', 'Orders', 'Trades'] as const).map((tab) => (
            <Tab
              key={tab}
              className={({ selected }) =>
                clsx(
                  'flex-1 py-4 text-sm font-medium transition-colors',
                  selected
                    ? 'text-gray-900 dark:text-white border-b-2 border-purple-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                )
              }
            >
              {tab}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="p-6">
          {(['Positions', 'Orders', 'Trades'] as const).map((tab) => (
            <Tab.Panel key={tab}>
              {renderTable(tab)}
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}