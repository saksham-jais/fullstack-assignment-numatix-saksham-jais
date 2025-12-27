import WebSocket from 'ws';
import { Server as WebSocketServer } from 'ws';
import http from 'http';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { URL } from 'url';

dotenv.config();

const PORT = Number(process.env.PORT) || 3002;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('JWT_SECRET is not set');
  process.exit(1);
}

if (!process.env.REDIS_URL) {
  console.error('REDIS_URL is not set');
  process.exit(1);
}

const redisSubscriber = new Redis(process.env.REDIS_URL, {
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: null,
});

redisSubscriber.on('error', (err) => console.error('Redis Error:', err));
redisSubscriber.on('connect', () => console.log('Redis connected'));
redisSubscriber.on('reconnecting', () => console.log('Redis reconnecting...'));

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ message: 'Event Service is running' }));
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const wss = new WebSocketServer({ server, path: '/prices' });

const clients = new Map<string, WebSocket>();

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const typedWs = ws as WebSocket & { isAlive?: boolean };
    if (!typedWs.isAlive) {
      console.log('Terminating dead WS');
      return typedWs.terminate();
    }
    typedWs.isAlive = false;
    typedWs.ping();
  });
}, 30000);

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  try {
    const origin = req.headers.origin || `http://${req.headers.host || 'localhost'}`;
    const url = new URL(req.url || '/', origin);

    const token = url.searchParams.get('token');
    if (!token) {
      ws.close(1008, 'Missing token');
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    if (!decoded?.userId) {
      ws.close(1008, 'Invalid token');
      return;
    }

    const userId = decoded.userId;

    clients.set(userId, ws);
    console.log(`WS connected → user: ${userId}`);

    ws.on('close', (code, reason) => {
      clients.delete(userId);
      console.log(`WS disconnected → user: ${userId} (code: ${code}, reason: ${reason})`);
    });

    const typedWs = ws as WebSocket & { isAlive?: boolean };
    typedWs.isAlive = true;

    typedWs.on('pong', () => {
      typedWs.isAlive = true;
    });

    ws.send(JSON.stringify({ type: 'WELCOME', message: 'Connected to order updates' }));
  } catch (err) {
    console.error('WS connection error:', err);
    ws.close(1008, 'Auth failed');
  }
});

wss.on('close', () => {
  clearInterval(interval);
  console.log('WS server closed');
});

redisSubscriber
  .subscribe('events:order:status')
  .then((count) => {
    console.log(`Subscribed to ${count} channels`);
  })
  .catch((err) => {
    console.error('Subscribe failed:', err);
    process.exit(1);
  });

redisSubscriber.on('message', (channel: string, message: string) => {
  if (channel !== 'events:order:status') return;

  let event: any;
  try {
    event = JSON.parse(message);
    console.log('Received event for broadcast:', event.orderId, 'Status:', event.status);
  } catch (err) {
    console.error('Parse error:', message, err);
    return;
  }

  if (!event?.userId || !event?.orderId) {
    console.warn('Invalid event structure:', event);
    return;
  }

  const ws = clients.get(event.userId);

  if (ws?.readyState === WebSocket.OPEN) {
    const wsMsg = {
      type: 'ORDER_UPDATE',
      data: event,
    };

    ws.send(JSON.stringify(wsMsg));
    console.log(`Broadcasted → user: ${event.userId} | order: ${event.orderId} | status: ${event.status}`);
  } else {
    console.log(`No active WS for user: ${event.userId} (event queued?)`);
    // Optionally, persist for later delivery
  }
});

const shutdown = () => {
  console.log('Shutting down event service...');
  clearInterval(interval);
  wss.close(() => {
    console.log('WS closed');
    redisSubscriber.quit().then(() => {
      console.log('Redis closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, () => {
  console.log(`Event Service on ws://localhost:${PORT}/prices`);
});