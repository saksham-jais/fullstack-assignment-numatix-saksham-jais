import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import Binance from 'binance-api-node';
import type { OrderCommand, OrderEvent, Position } from '@shared/types';
import { authenticate } from '../middleware/auth';
import { prisma } from '../auth';

const router = express.Router();
const redis = new Redis(process.env.REDIS_URL!);

interface BinancePublicClient {
  prices(): Promise<{ symbol: string; price: string; }[]>;
}

const publicClient = Binance({
  httpBase: 'https://testnet.binance.vision',
}) as unknown as BinancePublicClient;

router.post('/orders', authenticate, async (req: any, res: any) => {
  const { symbol, side, type, quantity, price } = req.body;

  if (!['MARKET', 'LIMIT'].includes(type)) {
    return res.status(400).json({ error: 'Only MARKET and LIMIT orders are supported' });
  }

  if (!symbol || !side || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Invalid order parameters' });
  }

  const orderId = uuidv4();

  const command: OrderCommand & { price?: number } = {  // Extend with optional price
    orderId,
    userId: req.userId,
    symbol: symbol.toUpperCase(),
    side: side as 'BUY' | 'SELL',
    type: type as 'MARKET' | 'LIMIT',
    quantity: parseFloat(quantity.toString()),
    timestamp: new Date().toISOString(),
    ...(price && { price: parseFloat(price.toString()) }),
  };

  try {
    await prisma.orderCommand.create({
      data: {
        orderId: command.orderId,
        userId: command.userId,
        symbol: command.symbol,
        side: command.side,
        type: command.type,
        quantity: command.quantity,
        status: 'PENDING',
      },
    });

    await redis.publish('commands:order:submit', JSON.stringify(command));

    res.json({ orderId, status: 'PENDING' });
  } catch (error) {
    console.error('Failed to submit order:', error);
    res.status(500).json({ error: 'Failed to submit order' });
  }
});

router.get('/orders', authenticate, async (req: any, res: any) => {
  try {
    const orders = await prisma.orderCommand.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/positions', authenticate, async (req: any, res: any) => {
  try {
    const rawEvents = await prisma.orderEvent.findMany({
      where: { userId: req.userId, status: 'FILLED' },
      orderBy: { createdAt: 'asc' },
    });

    const events: OrderEvent[] = rawEvents.map((e: any): OrderEvent => ({
      orderId: e.orderId,
      userId: e.userId,
      status: e.status as 'PENDING' | 'FILLED' | 'REJECTED' | 'PARTIALLY_FILLED',
      symbol: e.symbol,
      side: e.side as 'BUY' | 'SELL',
      quantity: e.quantity,
      price: e.price,
      timestamp: e.timestamp,
    }));

    const symbols = [...new Set(events.map((e) => e.symbol))];

    let priceMap: Record<string, number> = {};

    if (symbols.length > 0) {
      try {
        const tickerResponse = await publicClient.prices();
        const ticker: { symbol: string; price: string; }[] = tickerResponse;
        const tickerData = ticker
          .filter((t) => symbols.includes(t.symbol))
          .map((t) => ({
            symbol: t.symbol,
            price: parseFloat(t.price),
          }));
        priceMap = Object.fromEntries(tickerData.map((t) => [t.symbol, t.price]));
      } catch (err) {
        console.warn('Failed to fetch prices:', err);
      }
    }

    interface PositionData {
      quantity: number;
      cost: number;
    }

    const positions = events.reduce<Record<string, PositionData>>(
      (acc: Record<string, PositionData>, e: OrderEvent) => {
        const sym = e.symbol;
        if (!acc[sym]) {
          acc[sym] = { quantity: 0, cost: 0 };
        }

        const qtyChange = e.side === 'BUY' ? e.quantity : -e.quantity;
        acc[sym]!.quantity += qtyChange;
        acc[sym]!.cost += qtyChange * (e.price || 0);

        return acc;
      },
      {}
    );

    const positionArray: Position[] = Object.entries(positions)
      .filter(([_, data]) => Math.abs(data.quantity) > 0.00000001)
      .map(([symbol, data]) => {
        const markPrice = priceMap[symbol] || 0;
        const entryPrice = data.quantity !== 0 ? data.cost / data.quantity : 0;
        const unrealizedPnL = (markPrice - entryPrice) * data.quantity;
        const unrealizedPct = entryPrice !== 0 ? ((markPrice - entryPrice) / entryPrice) * 100 : 0;

        return {
          symbol,
          size: data.quantity,
          entryPrice: Number(entryPrice.toFixed(2)),
          markPrice: Number(markPrice.toFixed(2)),
          realizedPnL: 0, // Placeholder; calc from closed trades if needed
          unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
          unrealizedPnLPercent: Number(unrealizedPct.toFixed(2)),
        };
      });

    res.json(positionArray);
  } catch (error) {
    console.error('Failed to calculate positions:', error);
    res.status(500).json({ error: 'Failed to calculate positions' });
  }
});

export default router;