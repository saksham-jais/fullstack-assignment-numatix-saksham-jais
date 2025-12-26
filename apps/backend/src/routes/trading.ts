import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import Binance from 'binance-api-node';
import { OrderCommand } from '@shared/types';
import { authenticate } from '../middleware/auth';
import { prisma } from '../auth';

const router = express.Router();
const redis = new Redis(process.env.REDIS_URL!);

const publicClient = Binance({
  httpBase: 'https://testnet.binance.vision',
});

router.post('/orders', authenticate, async (req: any, res: any) => {
  const { symbol, side, type, quantity, price } = req.body;

  if (!['MARKET', 'LIMIT'].includes(type)) {
    return res.status(400).json({ error: 'Only MARKET and LIMIT orders are supported' });
  }

  if (!symbol || !side || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Invalid order parameters' });
  }

  const orderId = uuidv4();

  const command: any = {  // Use 'any' temporarily; update OrderCommand type to include optional price
    orderId,
    userId: req.userId,
    symbol: symbol.toUpperCase(),
    side,
    type,
    quantity,
    ...(price && { price }),  // Conditionally add price
    timestamp: new Date().toISOString(),
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
    const events = await prisma.orderEvent.findMany({
      where: { userId: req.userId, status: 'FILLED' },
      orderBy: { createdAt: 'asc' },
    });

    const symbols = [...new Set(events.map(e => e.symbol))];

    let priceMap: Record<string, number> = {};

    if (symbols.length > 0) {
      const pricePromises = symbols.map(async (sym) => {
        try {
          // Fixed: Use 'prices' for all symbols, then extract
          const tickerResponse = await publicClient.prices();
          // Type assertion for TS (prices() returns Record<string, string>)
          const ticker = tickerResponse as unknown as Record<string, string>;
          const symPrice = ticker[sym];
          return { symbol: sym, price: parseFloat(symPrice || '0') };
        } catch (err) {
          console.warn(`Failed to fetch price for ${sym}:`, err);
          return { symbol: sym, price: 0 };
        }
      });

      const tickerData = await Promise.all(pricePromises);
      priceMap = Object.fromEntries(tickerData.map(t => [t.symbol, t.price]));
    }

    const positions = events.reduce<Record<string, { quantity: number; cost: number }>>(
      (acc, e) => {
        const sym = e.symbol;
        if (!acc[sym]) acc[sym] = { quantity: 0, cost: 0 };

        const qtyChange = e.side === 'BUY' ? e.quantity : -e.quantity;
        acc[sym].quantity += qtyChange;
        acc[sym].cost += qtyChange * (e.price || 0);

        return acc;
      },
      {}
    );

    const positionArray = Object.entries(positions)
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