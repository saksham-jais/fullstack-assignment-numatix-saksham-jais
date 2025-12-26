import { useTradeStore } from "@/lib/tradeStore";

let socket: WebSocket | null = null;
let activeSymbol = "";

export function connectMarket(symbol: string) {
  console.log('connectMarket called with symbol:', symbol);
  const clean = symbol.toLowerCase();

  if (socket && activeSymbol === clean) {
    console.log('Already connected to', clean);
    return;
  }

  if (socket) {
    console.log('Closing existing socket for', activeSymbol);
    socket.close();
    socket = null;
  }

  activeSymbol = clean;
  console.log('Setting activeSymbol to', activeSymbol);

  socket = new WebSocket(
    `wss://stream.testnet.binance.vision/ws/${clean}@ticker`
  );

  socket.onopen = () => {
    console.log(`Market WS connected for ${clean}`);
  };

  socket.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      const price = parseFloat(data.c);
      const change = parseFloat(data.P);

      // Log the update to see if it's for the correct symbol
      console.log(`Market update for ${activeSymbol}: price ${price}, change ${change}%`);
      useTradeStore.getState().setCurrentPrice(price, change);
    } catch (err) {
      console.error('Failed to parse market ticker:', err);
    }
  };

  socket.onerror = (err) => {
    console.error('Market WS error:', err);
  };

  socket.onclose = (event) => {
    console.log(`Market WS closed for ${clean}:`, event.code, event.reason);
    socket = null;
    if (event.code !== 1000) {
      console.log('Scheduling reconnect for', clean);
      setTimeout(() => connectMarket(clean), 3000);
    }
  };
}