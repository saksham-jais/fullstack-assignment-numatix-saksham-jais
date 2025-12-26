'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useTradeStore } from '@/lib/tradeStore';
import TradeLayout from '../_components/TradeLayout';

export default function SymbolTradePage() {
  const params = useParams();
  const symbol = Array.isArray(params.symbol) ? params.symbol[0] : params.symbol;
  const { setSymbol } = useTradeStore();

  useEffect(() => {
    if (symbol) {
      setSymbol(symbol.toUpperCase());
    }
  }, [symbol, setSymbol]);

  return <TradeLayout />;
}