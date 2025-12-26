'use client';

import { useState, useEffect } from 'react';
import { useTradeStore } from '@/lib/tradeStore';
import { placeOrder } from '@/lib/api';

const orderTypes = ['Limit', 'Market', 'Stop Market'] as const;
type OrderType = typeof orderTypes[number];

const commonSymbols = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'ADAUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'LINKUSDT',
];

const AVAILABLE_BALANCE = 30.16; // Mock USDT balance

export default function OrderEntryPanel() {
  const { symbol, setSymbol, currentPrice, positions, fetchPositions, setCurrentPrice } = useTradeStore();

  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [type, setType] = useState<OrderType>('Limit');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('0.001');
  const [sliderValue, setSliderValue] = useState(50);
  const [loading, setLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);

  // Fetch positions on mount and periodically (e.g., every 10s) for dynamic updates
  const safeFetchPositions = async () => {
    setPositionsLoading(true);
    setPositionsError(null);
    try {
      await fetchPositions();
    } catch (err: any) {
      console.error('Failed to fetch positions:', err);
      setPositionsError(err.message || 'Failed to load positions. Backend may be offline.');
    } finally {
      setPositionsLoading(false);
    }
  };

  useEffect(() => {
    safeFetchPositions();
    const interval = setInterval(safeFetchPositions, 10000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  // Calculate quantity from slider (based on available balance and current price)
  useEffect(() => {
    if (!currentPrice || type !== 'Market') return;

    const maxQty = AVAILABLE_BALANCE / currentPrice;
    const newQty = (maxQty * (sliderValue / 100)).toFixed(6);
    setQuantity(newQty);
  }, [sliderValue, currentPrice, type]);

  // Calculate total cost
  const qty = parseFloat(quantity) || 0;
  const effectivePrice = type === 'Limit' ? parseFloat(limitPrice) || 0 : currentPrice || 0;
  const total = type === 'Market' 
    ? currentPrice ? (qty * currentPrice).toFixed(2) : 'Market'
    : (qty * effectivePrice).toFixed(2);

  // Compute account summary dynamically (fallback to mock if error)
  let totalUnrealizedPnL = 0;
  if (!positionsError && positions.length > 0) {
    totalUnrealizedPnL = positions.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0);
  } else if (positionsError) {
    // Mock a simple position for demo if backend down
    totalUnrealizedPnL = 1.25; // Example positive PnL
  }
  const marginBalance = AVAILABLE_BALANCE + totalUnrealizedPnL; // Dynamic mock based on PnL
  const maintenanceMargin = 50; // Mock fixed maintenance
  const marginRatio = marginBalance > 0 ? ((maintenanceMargin + Math.abs(totalUnrealizedPnL)) / marginBalance * 100).toFixed(2) : '0.00';

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'b') setSide('BUY');
      if (e.key.toLowerCase() === 's') setSide('SELL');
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleOrder();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [side, type, quantity, limitPrice, loading]);

  const handleOrder = async () => {
    if (loading || qty <= 0) return;
    if (type === 'Limit' && !limitPrice) return;

    setLoading(true);
    setOrderError(null);
    try {
      const orderData: any = {
        symbol,
        side,
        type: type === 'Stop Market' ? 'STOP_MARKET' : type.toUpperCase(),
        quantity: qty,
      };

      if (type === 'Limit' && limitPrice) {
        orderData.price = parseFloat(limitPrice);
      }

      await placeOrder(orderData);

      // Optimistic update: Immediately add/update position in store for BUY (long position)
      if (side === 'BUY') {
        const entryPrice = effectivePrice || currentPrice || 0;
        const newSize = qty;
        const newMarkPrice = currentPrice || 0;

        // Find existing position or create new
        const existingIndex = positions.findIndex(p => p.symbol === symbol);
        if (existingIndex > -1) {
          // Add to existing (average entry)
          const existing = positions[existingIndex];
          const totalQty = existing.size + newSize;
          const avgEntry = ((existing.size * existing.entryPrice) + (newSize * entryPrice)) / totalQty;
          const newUnrealized = (newMarkPrice - avgEntry) * totalQty;
          const newUnrealizedPct = avgEntry !== 0 ? ((newMarkPrice - avgEntry) / avgEntry) * 100 : 0;

          positions[existingIndex] = {
            ...existing,
            size: totalQty,
            entryPrice: avgEntry,
            markPrice: newMarkPrice,
            unrealizedPnL: newUnrealized,
            unrealizedPnLPercent: newUnrealizedPct,
          };
        } else {
          // Add new position
          const newPos = {
            symbol,
            size: newSize,
            entryPrice,
            markPrice: newMarkPrice,
            realizedPnL: 0,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
          };
          positions.push(newPos);
        }

        // Trigger store update (since positions is from store, but to persist, call setCurrentPrice to trigger update logic)
        setCurrentPrice(newMarkPrice);  // This will re-compute PnL for all positions
      }

      // Success feedback
      alert(`✅ ${side} ${qty.toFixed(6)} ${symbol} order placed successfully! Position updated (optimistic). Check backend logs for sync.`);
      setQuantity('0.001');
      setLimitPrice('');
      setSliderValue(50);
      // Refresh positions immediately after order (for backend sync)
      await safeFetchPositions();
    } catch (err: any) {
      console.error('Order placement failed:', err);
      setOrderError(err.message || 'Order failed. Check backend connection.');
      alert(`❌ Order failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-6 h-full flex flex-col overflow-y-auto">
      {/* Buy / Sell Tabs */}
      <div className="flex gap-3">
        <button
          onClick={() => setSide('BUY')}
          className={`flex-1 py-3.5 rounded-xl font-bold text-lg transition-all ${
            side === 'BUY'
              ? 'bg-green-600 text-white shadow-lg'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          BUY
        </button>
        <button
          onClick={() => setSide('SELL')}
          className={`flex-1 py-3.5 rounded-xl font-bold text-lg transition-all ${
            side === 'SELL'
              ? 'bg-red-600 text-white shadow-lg'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          SELL
        </button>
      </div>

      {/* Order Type Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {orderTypes.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
              type === t
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Symbol Selector */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Symbol</label>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="w-full mt-2 px-4 py-3.5 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-4 focus:ring-purple-500/30 focus:border-purple-500 text-lg font-medium"
        >
          {commonSymbols.map((s) => (
            <option key={s} value={s}>
              {s.replace('USDT', '/USDT')}
            </option>
          ))}
        </select>
      </div>

      {/* Limit Price Input */}
      {type === 'Limit' && (
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Limit price</label>
          <div className="flex mt-2">
            <input
              type="number"
              step="0.01"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder={currentPrice ? currentPrice.toFixed(2) : '0.00'}
              className="flex-1 px-4 py-3.5 bg-gray-50 dark:bg-gray-700 rounded-l-xl border border-r-0 border-gray-300 dark:border-gray-600 focus:outline-none focus:z-10"
            />
            <span className="px-6 py-3.5 bg-gray-100 dark:bg-gray-600 rounded-r-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 font-medium">
              USDT
            </span>
          </div>
        </div>
      )}

      {/* Quantity & Total */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
          <input
                        type="number"
            step="0.000001"
            min="0"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              // Update slider approximately
              if (currentPrice && type === 'Market') {
                const maxQty = AVAILABLE_BALANCE / currentPrice;
                const percent = (parseFloat(e.target.value) / maxQty) * 100;
                setSliderValue(Math.min(100, Math.max(0, percent)));
              }
            }}
            className="w-full mt-2 px-4 py-3.5 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-4 focus:ring-purple-500/30"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</label>
          <div className="mt-2 px-4 py-3.5 bg-gray-100 dark:bg-gray-600 rounded-xl text-right font-bold text-lg">
            {total} USDT
          </div>
        </div>
      </div>

      {/* Percentage Slider */}
      <div>
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={(e) => setSliderValue(Number(e.target.value))}
          className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${sliderValue}%, #e5e7eb ${sliderValue}%, #e5e7eb 100%)`,
          }}
        />
        <div className="text-right text-sm font-semibold text-purple-600 mt-2">{sliderValue}%</div>
      </div>

      {/* Available Balance */}
      <div className="flex justify-between items-center py-4 border-t border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-600 dark:text-gray-400">Available</span>
        <span className="font-bold text-lg">{AVAILABLE_BALANCE.toFixed(2)} USD</span>
        <button className="text-sm font-medium text-purple-600 hover:text-purple-700 underline">
          Add funds
        </button>
      </div>

      {/* Order Error Display */}
      {orderError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {orderError}
          <button
            onClick={() => setOrderError(null)}
            className="ml-2 underline hover:text-red-700 dark:hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Positions Error Display */}
      {positionsError && !positionsLoading && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-600 dark:text-yellow-400 text-sm">
          {positionsError}
          <button
            onClick={safeFetchPositions}
            className="ml-2 underline hover:text-yellow-700 dark:hover:text-yellow-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* Place Order Button */}
      <button
        onClick={handleOrder}
        disabled={loading || qty <= 0 || (type === 'Limit' && !limitPrice)}
        className={`w-full py-5 rounded-full text-xl font-bold text-white transition-all shadow-2xl ${
          side === 'BUY'
            ? 'bg-black hover:bg-gray-900 active:scale-95'
            : 'bg-red-600 hover:bg-red-700 active:scale-95'
        } disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${loading ? 'animate-pulse' : ''}`}
      >
        {loading ? 'Placing Order...' : `${side} ${symbol.replace('USDT', '/USD')}`}
      </button>

      {/* Account Summary */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4 text-sm">
        <h3 className="font-bold text-gray-900 dark:text-white">
          Account {positionsLoading ? '(Loading...)' : ''}
        </h3>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Margin Ratio</span>
          <span className="font-medium">{marginRatio}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Maintenance Margin</span>
          <span className="font-medium">{maintenanceMargin.toFixed(6)} USDT</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Margin Balance</span>
          <span className="font-medium">{marginBalance.toFixed(6)} USDT</span>
        </div>
        {positionsError && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
            Using mock data due to connection issue. Start backend services (npm run dev:backend, dev:event).
          </div>
        )}
      </div>
    </div>
  );
}