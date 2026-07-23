import { WebSocketServer, type WebSocket } from 'ws';
import { config } from './config.js';
import type { AggregatorMessage } from './types.js';
import type { Collector } from './collectors/types.js';
import { createNotionCollector } from './collectors/notion.js';
import { createExchangeRateCollector } from './collectors/exchange-rate.js';
import { createCalendarCollector } from './collectors/calendar.js';

const clients = new Set<WebSocket>();

function broadcast(msg: AggregatorMessage): void {
  const payload = JSON.stringify(msg);
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
