'use client';
import { useEffect } from 'react';
import { useAuth } from './auth';
import { useTradeStore } from './tradeStore';

export function WebSocketProvider() {
  const { token } = useAuth();
  useEffect(() => {
    if (!token) {
      console.log('No token - skipping WS connection');
      return;
    }
    console.log('Attempting WS connect with token:', token.substring(0, 20) + '...');
    let reconnectAttempts = 0;
    const maxAttempts = 5;  // Increased for robustness
    let reconnectTimer: NodeJS.Timeout;
    const connect = () => {
      const ws = new WebSocket(`ws://localhost:3002/prices?token=${token}`);
      ws.onopen = () => {
        console.log('Order WS connected');
        reconnectAttempts = 0;
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received WS message:', data.type);
          if (data.type === 'ORDER_UPDATE') {
            const store = useTradeStore.getState();
            store.updateOrder(data.data);
            // Auto-refetch positions if order filled
            if (data.data.status === 'FILLED') {
              console.log('Order filled, refetching positions');
              store.fetchPositions().catch(err => console.error('Refetch failed:', err));
            }
          } else if (data.type === 'WELCOME') {
            console.log('WS welcome:', data.message);
          }
        } catch (err) {
          console.error('Failed to parse order update:', err);
        }
      };
      ws.onerror = (err) => {
        console.error('Order WS error:', err);
        attemptReconnect();
      };
      ws.onclose = (event) => {
        console.log('Order WS closed:', event.code, event.reason);
        if (event.code === 1006) {
          console.warn('Network close (1006) - ensure event service (3002) is running');
        }
        if (event.code !== 1000 && reconnectAttempts < maxAttempts) {
          attemptReconnect();
        } else if (event.code === 1008) {
          console.error('Auth failed - check JWT_SECRET consistency');
        } else if (reconnectAttempts >= maxAttempts) {
          console.error('Max reconnect attempts reached. Check event service.');
        }
      };
      const attemptReconnect = () => {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);  // Start from 1s, up to 10s
        reconnectTimer = setTimeout(connect, delay);
        console.log(`Reconnect attempt ${reconnectAttempts}/${maxAttempts} in ${delay}ms`);
      };
      return () => {
        clearTimeout(reconnectTimer);
        ws.close();
      };
    };
    const cleanup = connect();
    return cleanup;
  }, [token]);
  return null;
}