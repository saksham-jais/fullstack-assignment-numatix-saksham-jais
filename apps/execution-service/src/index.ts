import Redis from 'ioredis';
import Binance from 'binance-api-node';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const subscriber = new Redis(process.env.REDIS_URL!);  // Subscriber for commands
const publisher = new Redis(process.env.REDIS_URL!);   // Publisher for events

subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
publisher.on('error', (err) => console.error('Redis Publisher Error:', err));

subscriber.subscribe('commands:order:submit', (err) => {
  if (err) {
    console.error('Subscribe failed:', err);
    process.exit(1);
  }
  console.log('Subscribed to order commands');
});

interface SymbolInfo {
  symbol: string;
  filters: Array<{
    filterType: string;
    minQty: string;
    stepSize: string;
  }>;
}

subscriber.on('message', async (channel, message) => {
  if (channel !== 'commands:order:submit') return;

  let command;
  try {
    command = JSON.parse(message);
    console.log('Processing order command:', command.orderId, 'Symbol:', command.symbol);
  } catch (parseErr) {
    console.error('Failed to parse command:', parseErr);
    return;
  }

  try {
    // Fetch user keys
    const user = await prisma.user.findUnique({ where: { id: command.userId } });
    if (!user) {
      throw new Error(`User not found: ${command.userId}`);
    }

    let apiKey, secretKey;
    try {
      apiKey = Buffer.from(user.binanceApiKey, 'base64').toString();
      secretKey = Buffer.from(user.binanceSecretKey, 'base64').toString();
    } catch (decodeErr) {
      throw new Error('Invalid Binance keys (base64 decode failed)');
    }

    const client = Binance({
      apiKey,
      apiSecret: secretKey,
      httpBase: 'https://testnet.binance.vision',
    });

    // Fetch full exchange info
    const exchangeInfo = await client.exchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find((s: SymbolInfo) => s.symbol === command.symbol);
    if (!symbolInfo) {
      throw new Error(`Symbol info not found for ${command.symbol}`);
    }

    const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
    if (!lotSizeFilter) {
      throw new Error(`LOT_SIZE filter not found for ${command.symbol}`);
    }

    const minQty = parseFloat(lotSizeFilter.minQty);
    const stepSize = parseFloat(lotSizeFilter.stepSize);

    // Round quantity to step size
    let roundedQty = Math.floor(command.quantity / stepSize) * stepSize;
    if (roundedQty < minQty) {
      roundedQty = minQty;
    }

    if (roundedQty === 0) {
      throw new Error(`Quantity too small for ${command.symbol}. Min: ${minQty}`);
    }

    console.log(`Rounded quantity: ${command.quantity} → ${roundedQty} (min: ${minQty}, step: ${stepSize})`);

    // Prepare order params
    const orderParams: any = {
      symbol: command.symbol,
      side: command.side,
      quantity: roundedQty.toString(),
    };

    if (command.type === 'MARKET') {
      orderParams.type = 'MARKET';
    } else if (command.type === 'LIMIT') {
      if (!command.price || isNaN(parseFloat(command.price))) {
        throw new Error('Price required for LIMIT order');
      }
      orderParams.type = 'LIMIT';
      orderParams.price = command.price.toString();
      orderParams.timeInForce = 'GTC';  // Good 'Til Canceled
    } else {
      throw new Error(`Unsupported order type: ${command.type}`);
    }

    console.log('Executing order with params:', orderParams);

    // Execute order
    const orderResult = await client.order(orderParams);
    console.log('Binance order result:', orderResult);

    // Prepare event
    const event = {
      orderId: command.orderId,
      userId: command.userId,
      status: orderResult.status || 'FILLED',  // Use actual status
      symbol: command.symbol,
      side: command.side,
      quantity: roundedQty,
      price: parseFloat(orderResult.price || orderResult.cummulativeQuoteQty 
        ? (parseFloat(orderResult.cummulativeQuoteQty) / roundedQty).toString() 
        : '0'),
      timestamp: new Date(orderResult.transactTime || Date.now()).toISOString(),
    };

    // Create OrderEvent
    await prisma.orderEvent.create({
      data: event,
    });

    // Publish event using publisher client
    await publisher.publish('events:order:status', JSON.stringify(event));

    // Update OrderCommand status
    await prisma.orderCommand.update({
      where: { orderId: command.orderId },
      data: { status: event.status },
    });

    console.log(`Successfully executed order ${command.orderId} for user ${command.userId}, status: ${event.status}, qty: ${roundedQty}`);
  } catch (error: any) {
    console.error('Execution failed for order', command?.orderId || 'unknown', ':', error);

    const status = 'REJECTED';
    const rejectedEvent = {
      orderId: command?.orderId || 'unknown',
      userId: command?.userId || 'unknown',
      status,
      symbol: command?.symbol || 'UNKNOWN',
      side: command?.side || 'UNKNOWN',
      quantity: command?.quantity || 0,
      price: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      await prisma.orderEvent.create({ data: rejectedEvent });
      // Publish using publisher client
      await publisher.publish('events:order:status', JSON.stringify(rejectedEvent));

      // Update command if possible
      if (command?.orderId) {
        await prisma.orderCommand.update({
          where: { orderId: command.orderId },
          data: { status },
        });
      }
    } catch (updateErr) {
      console.error('Failed to create rejected event or update command:', updateErr);
    }
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down execution service...');
  await prisma.$disconnect();
  subscriber.disconnect();
  publisher.disconnect();
  process.exit(0);
});