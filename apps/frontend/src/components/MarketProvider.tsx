'use client';
import { useEffect } from "react";
import { useTradeStore } from "@/lib/tradeStore";
import { WebSocketProvider } from "@/lib/ws";

export default function MarketProvider({ children }: { children: React.ReactNode }) {
  // Remove useEffect connectMarket - handled in store
  return (
    <>
      <WebSocketProvider />
      {children}
    </>
  );
}