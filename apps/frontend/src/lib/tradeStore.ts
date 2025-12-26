'use client';
import { create } from 'zustand';
import axios from 'axios';
import { getToken } from './auth';
import { Position } from '@shared/types';

interface TradeStore {
  symbol: string;
  timeframe: string;
  currentPrice: number | null;
  priceChange24h: number | null;
  orders: any[];
  positions: Position[];
  setSymbol: (symbol: string) => void;
  setTimeframe: (tf: string) => void;
  setCurrentPrice: (price: number, change?: number) => void;
  fetchOrders: () => Promise<void>;
  fetchPositions: () => Promise<void>;
  updateOrder: (orderData: any) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001/api';

let marketSocket: WebSocket | null = null;
let activeSymbol = "";
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectDelay = 1000;

function closeMarketSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (marketSocket) {
    console.log('Closing market socket for', activeSymbol);
    marketSocket.close(1000, 'Symbol change');
    marketSocket = null;
  }
}

function connectMarket(symbol: string) {
  const clean = symbol.toLowerCase();
  
  // If already connected to this symbol, do nothing
  if (marketSocket && activeSymbol === clean && marketSocket.readyState === WebSocket.OPEN) {
    console.log('Already connected to', clean);
    return;
  }
  
  // Close existing connection
  closeMarketSocket();
  activeSymbol = clean;
  
  console.log('Connecting market socket for', clean);
  marketSocket = new WebSocket(
    `wss://stream.testnet.binance.vision/ws/${clean}@ticker`
  );
  
  marketSocket.onopen = () => {
    console.log(`Market WS connected for ${clean}`);
    reconnectDelay = 1000; // Reset backoff
  };
  
  marketSocket.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      // Only process if this is still the active symbol
      if (data.s.toLowerCase() !== activeSymbol) {
        console.log('Ignoring stale data for', data.s.toLowerCase(), 'active is', activeSymbol);
        return;
      }
      const price = parseFloat(data.c);
      const change = parseFloat(data.P);
      console.log(`Market update for ${activeSymbol}: price ${price}, change ${change.toFixed(2)}%`);
      useTradeStore.getState().setCurrentPrice(price, change);
    } catch (err) {
      console.error('Failed to parse market ticker:', err);
    }
  };
  
  marketSocket.onerror = (err) => {
    console.error('Market WS error:', err);
  };
  
  marketSocket.onclose = (event) => {
    console.log(`Market WS closed for ${clean}:`, event.code, event.reason);
    marketSocket = null;
    
    // Only reconnect if this is still the active symbol and it wasn't a normal close
    if (clean === activeSymbol && event.code !== 1000) {
      const delay = Math.min(reconnectDelay, 30000);
      console.log(`Scheduling reconnect for ${clean} in ${delay}ms`);
      reconnectTimer = setTimeout(() => {
        reconnectDelay *= 2; // Exponential backoff
        connectMarket(clean);
      }, delay);
    }
  };
}

// Remove persist middleware to avoid storage errors
export const useTradeStore = create<TradeStore>((set, get) => ({
  symbol: 'BTCUSDT',
  timeframe: '1h',
  currentPrice: null,
  priceChange24h: null,
  orders: [],
  positions: [],
  
  setSymbol: (symbol) => {
    console.log('Setting symbol to', symbol);
    set({ symbol, currentPrice: null, priceChange24h: null }); // Reset price on symbol change
    connectMarket(symbol);
  },
  
  setTimeframe: (tf) => {
    console.log('Setting timeframe to', tf);
    set({ timeframe: tf });
  },
  
  setCurrentPrice: (price: number, change?: number) => {
    const state = get();
    const currentPositions = state.positions;
    
    // Update positions with new mark price
    const updatedPositions = currentPositions.map((pos) => {
      if (pos.symbol === state.symbol) {
        const entryPrice = pos.entryPrice;
        const newUnrealized = (price - entryPrice) * pos.size;
        const newUnrealizedPct = entryPrice !== 0 ? ((price - entryPrice) / entryPrice) * 100 : 0;
        return { 
          ...pos, 
          markPrice: price, 
          unrealizedPnL: newUnrealized, 
          unrealizedPnLPercent: newUnrealizedPct 
        };
      }
      return pos;
    });
    
    set({
      currentPrice: price,
      priceChange24h: change ?? state.priceChange24h,
      positions: updatedPositions,
    });
  },
  
  fetchOrders: async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await axios.get(`${API_BASE}/trading/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({ orders: res.data });
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  },
  
  fetchPositions: async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await axios.get(`${API_BASE}/trading/positions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({ positions: res.data });
    } catch (err) {
      console.error('Failed to fetch positions:', err);
    }
  },
  
  updateOrder: (orderData) => {
    set((state) => ({
      orders: state.orders.map((o) => 
        o.orderId === orderData.orderId ? { ...o, ...orderData } : o
      ),
    }));
    if (['FILLED', 'REJECTED', 'PARTIALLY_FILLED'].includes(orderData.status)) {
      get().fetchPositions();
    }
  },
}));

// Initialize market socket on store creation
connectMarket('BTCUSDT');

// Export cleanup function for app unmount
export function cleanupMarketSocket() {
  closeMarketSocket();
}