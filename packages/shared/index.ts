export interface OrderCommand {
  orderId: string;
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  timestamp: string;
}

export interface OrderEvent {
  orderId: string;
  userId: string;
  status: 'PENDING' | 'FILLED' | 'REJECTED' | 'PARTIALLY_FILLED';
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  timestamp: string;
}

export interface WSMessage {
  type: 'ORDER_UPDATE';
  data: OrderEvent;
}

export interface RegisterPayload {
  email: string;
  password: string;
  binanceApiKey: string;
  binanceSecretKey: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

export interface Position {
  symbol: string;
  size: number;
  entryPrice: number;
  markPrice: number;
  realizedPnL: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}