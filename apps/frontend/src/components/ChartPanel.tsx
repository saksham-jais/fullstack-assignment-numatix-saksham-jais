'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { ColorType } from 'lightweight-charts';
import { useTradeStore } from '@/lib/tradeStore';
import { useThemeStore } from '@/lib/themeStore';

const timeframes = ['1m', '5m', '1h', '1D', '1W'] as const;

interface CandleData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function ChartPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeStreamRef = useRef<string>('');
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  const [chartReady, setChartReady] = useState(false);  // Track if chart is fully initialized
  const { symbol, timeframe, setTimeframe, setCurrentPrice, currentPrice, priceChange24h } = useTradeStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const closeWs = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close(1000, 'Symbol/timeframe change');
      wsRef.current = null;
    }
    activeStreamRef.current = '';
    setWsStatus('disconnected');
  }, []);

  const connectLiveStream = useCallback(() => {
    closeWs();
    
    const tfLower = timeframe.toLowerCase();
    const interval = tfLower === '1d' ? '1d' : tfLower === '1w' ? '1w' : tfLower;
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    
    if (activeStreamRef.current === stream) {
      console.log('Already connected to', stream);
      return;
    }
    
    activeStreamRef.current = stream;
    const wsUrl = `wss://stream.testnet.binance.vision/ws/${stream}`;
    console.log('Connecting chart WS to:', wsUrl);
    
    setWsStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`Chart WS connected for ${stream}`);
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const k = msg.k;
        if (!k) return;
        
        // Ignore if not for active symbol
        if (msg.s?.toLowerCase() !== symbol.toLowerCase()) {
          return;
        }
        
        const candle: CandleData = {
          time: Math.floor(Number(k.t) / 1000) as UTCTimestamp,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        };
        
        // Validate candle data
        if (isNaN(candle.time) || isNaN(candle.open) || isNaN(candle.high) || 
            isNaN(candle.low) || isNaN(candle.close) ||
            candle.high < candle.low || candle.open <= 0 || candle.close <= 0 ||
            candle.high < Math.max(candle.open, candle.close) || 
            candle.low > Math.min(candle.open, candle.close)) {
          console.warn('Invalid candle data, skipping:', k);
          return;
        }
        
        if (seriesRef.current) {
          seriesRef.current.update(candle);
        }
        setCurrentPrice(candle.close);
      } catch (err) {
        console.error('Kline parse error:', err);
      }
    };

    ws.onclose = (event) => {
      console.log(`Chart WS closed for ${stream}: code ${event.code}`);
      wsRef.current = null;
      
      if (activeStreamRef.current === stream && event.code !== 1000) {
        const delay = Math.min(1000 * Math.pow(2, 1), 30000);  // Exponential backoff, cap 30s
        setWsStatus('connecting');
        reconnectTimeoutRef.current = setTimeout(() => {
          connectLiveStream();
        }, delay);
      } else {
        setWsStatus('disconnected');
      }
    };

    ws.onerror = (error) => {
      console.error('Chart WS error:', error);
    };
  }, [symbol, timeframe, setCurrentPrice, closeWs]);

  // Load historical data
  const loadHistorical = useCallback(async () => {
    setLoading(true);
    setHistoricalError(null);
    try {
      const tfLower = timeframe.toLowerCase();
      const interval = tfLower === '1d' ? '1d' : tfLower === '1w' ? '1w' : tfLower;
      const limit = tfLower === '1w' ? 52 : tfLower === '1d' ? 30 : 100;
      const url = `https://testnet.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch klines: ${res.status}`);
      const data = await res.json();
      
      const formatted: CandleData[] = data
        .map((k: any[]) => {
          const time = Math.floor(Number(k[0]) / 1000) as UTCTimestamp;
          const open = parseFloat(k[1]);
          const high = parseFloat(k[2]);
          const low = parseFloat(k[3]);
          const close = parseFloat(k[4]);
          
          if (isNaN(time) || isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) ||
              high < low || open <= 0 || close <= 0 ||
              high < Math.max(open, close) || low > Math.min(open, close)) {
            console.warn('Invalid historical candle, skipping');
            return null;
          }
          return { time, open, high, low, close };
                })
        .filter((candle: CandleData | null): candle is CandleData => candle !== null);
      
      console.log(`Loaded ${formatted.length} candles for ${symbol}`);
      
      if (seriesRef.current) {
        seriesRef.current.setData(formatted);
      }
      if (formatted.length > 0) {
        setCurrentPrice(formatted[formatted.length - 1].close);
      }
    } catch (err: any) {
      console.error('Historical load error:', err);
      setHistoricalError(err.message || 'Failed to load historical data');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, setCurrentPrice]);

  // Initialize chart
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Cleanup previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    let chart: IChartApi | null = null;
    let series: ISeriesApi<'Candlestick'> | null = null;

    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => {
        if (chart && container) {
          const width = container.clientWidth;
          const height = container.clientHeight;
          if (width > 0 && height > 0) {
            chart.resize(width, height);
          }
        }
      }, 100);
    });
    resizeObserver.observe(container);

    async function initChart() {
      if (!container) return;
      
      let width = container.clientWidth;
      let height = container.clientHeight;
      if (width === 0 || height === 0) {
        width = 800;
        height = 400;
      }
      
      console.log('Initializing chart for', symbol, 'with dimensions:', width, 'x', height);
      
      try {
        const { createChart } = await import('lightweight-charts');
        chart = createChart(container, {
          width,
          height,
          layout: {
            background: { type: ColorType.Solid, color: isDark ? '#111827' : '#ffffff' },
            textColor: isDark ? '#f3f4f6' : '#1f2937',
          },
          grid: {
            vertLines: { color: isDark ? '#374151' : '#e5e7eb' },
            horzLines: { color: isDark ? '#374151' : '#e5e7eb' },
          },
          crosshair: { mode: 1 },
          timeScale: {
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            rightOffset: 12,
            barSpacing: 3,
          },
          rightPriceScale: { borderColor: isDark ? '#4b5563' : '#e5e7eb' },
        });

        series = chart.addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
          priceLineVisible: true,
          priceLineStyle: 2,
          priceLineWidth: 1,
          priceLineColor: isDark ? '#10b981' : '#ef4444',
        });

        chartRef.current = chart;
        seriesRef.current = series;
        
        await loadHistorical();
        
        if (chart && chart.timeScale) {
          chart.timeScale().fitContent();
        }

        // Force resize after init
        setTimeout(() => {
          if (chart && container) {
            const currentWidth = container.clientWidth;
            const currentHeight = container.clientHeight;
            if (currentWidth > 0 && currentHeight > 0) {
              chart.resize(currentWidth, currentHeight);
            }
          }
          setChartReady(true);
        }, 100);
      } catch (err) {
        console.error('Failed to initialize chart:', err);
        setHistoricalError('Chart initialization failed');
        setLoading(false);  // Ensure loading is cleared on init failure to show error overlay
      }
    }

    initChart();

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [symbol, timeframe, isDark, loadHistorical]);

// Connect to live stream when symbol/timeframe changes
  useEffect(() => {
    connectLiveStream();
    return closeWs;
  }, [connectLiveStream, closeWs]);

  // Update theme
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#111827' : '#ffffff' },
        textColor: isDark ? '#f3f4f6' : '#1f2937',
      },
      grid: {
        vertLines: { color: isDark ? '#374151' : '#e5e7eb' },
        horzLines: { color: isDark ? '#374151' : '#e5e7eb' },
      },
      timeScale: { borderColor: isDark ? '#4b5563' : '#e5e7eb' },
      rightPriceScale: { borderColor: isDark ? '#4b5563' : '#e5e7eb' },
    });
    if (seriesRef.current) {
      seriesRef.current.applyOptions({
        upColor: '#10b981',
        downColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
        priceLineColor: isDark ? '#10b981' : '#ef4444',
      });
    }
  }, [theme, isDark]);

  const changeColor = priceChange24h !== null
    ? priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
    : 'text-gray-500';
  const formattedChange = priceChange24h !== null
    ? `${priceChange24h >= 0 ? '↑' : '↓'} ${Math.abs(priceChange24h).toFixed(2)}%`
    : '—';
  const formattedPrice = currentPrice
    ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {symbol.replace('USDT', '/USDT')}
            </h2>
            <div className="flex items-baseline gap-4 mt-3">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                {formattedPrice}
              </span>
              <span className={`text-xl font-semibold ${changeColor}`}>
                {formattedChange}
              </span>
            </div>
            <span className={`text-xs mt-1 block ${wsStatus === 'connected' ? 'text-green-600' : wsStatus === 'connecting' ? 'text-yellow-600' : 'text-red-600'}`}>
              {wsStatus === 'connected' ? '● Live' : wsStatus === 'connecting' ? '● Connecting...' : '● Disconnected'}
            </span>
            {historicalError && (
              <span className="text-xs text-red-600 block mt-1">Error: {historicalError}</span>
            )}
          </div>
          <div className="flex gap-2">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf === '1D' ? '1d' : tf === '1W' ? '1w' : tf)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeframe === (tf === '1D' ? '1d' : tf === '1W' ? '1w' : tf)
                    ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>
<div className="flex-1 relative bg-gray-50 dark:bg-gray-900 min-h-[400px]">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        {loading && !chartReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10">
            <div className="text-lg font-medium text-gray-600 dark:text-gray-300">
              Loading {symbol} chart...
            </div>
          </div>
        )}
        {historicalError && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10">
            <div className="text-lg font-medium text-red-600 dark:text-red-300">
              Chart Error: {historicalError}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}