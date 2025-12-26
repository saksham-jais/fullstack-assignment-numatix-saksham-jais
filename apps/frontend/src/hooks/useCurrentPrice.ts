'use client';

import { useTradeStore } from '@/lib/tradeStore';

export function useCurrentPrice(): {
  price: number | null;
  formatted: string;
  isLoading: boolean;
} {
  const currentPrice = useTradeStore((state) => state.currentPrice);

  return {
    price: currentPrice,
    formatted: currentPrice
      ? currentPrice.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 8,
        })
      : '—.--',
    isLoading: currentPrice === null,
  };
}