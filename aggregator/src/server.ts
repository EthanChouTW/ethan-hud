import { WebSocketServer, type WebSocket } from 'ws';
import { config } from './config.js';
import type { AggregatorMessage } from './types.js';
import type { Collector } from './collectors/types.js';
import { createNotionCollector } from './collectors/notion.js';
import { createExchangeRateCollector } from './collectors/exchange-rate.js';
import { createCalendarCollector } from './collectors/calendar.js';

const clients = new Set<WebSocket>();
const latestByType = new Map<string, string>();

function broadcast(msg: AggregatorMessage): void {
  const payload = JSON.stringify(msg);
  latestByType.set(msg.type, payload);
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

// Start WebSocket server
const wss = new WebSocketServer({ port: config.wsPort });
console.log(`[server] WebSocket listening on :${config.wsPort}`);

wss.on('connection', (ws, req) => {
  const addr = req.socket.remoteAddress ?? 'unknown';
  console.log(`[server] client connected from ${addr}`);
  clients.add(ws);

  for (const payload of latestByType.values()) {
    ws.send(payload);
  }

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as { collector: string; action: string; payload: Record<string, unknown> };
      const collector = collectors.find((c) => c.name === msg.collector);
      if (collector?.handleAction) {
        await collector.handleAction(msg.action, msg.payload);
      }
    } catch (err) {
      console.error('[server] upstream message error:', err instanceof Error ? err.message : err);
    }
  });

  ws.on('close', () => {
    console.log(`[server] client disconnected from ${addr}`);
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error(`[server] client error:`, err.message);
    clients.delete(ws);
  });
});

// Start collectors
const collectors: Collector[] = [createNotionCollector(), createExchangeRateCollector()];

if (config.calendarEnabled) {
  collectors.push(createCalendarCollector());
} else {
  console.log('[server] calendar collector disabled via CALENDAR_ENABLED=false');
}

for (const collector of collectors) {
  console.log(`[server] starting collector: ${collector.name}`);
  collector.start(broadcast);
}

// Graceful shutdown
function shutdown() {
  console.log('[server] shutting down...');
  for (const collector of collectors) {
    collector.stop();
  }
  for (const client of clients) {
    client.close();
  }
  wss.close(() => {
    console.log('[server] closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
