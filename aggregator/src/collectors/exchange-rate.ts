import type { Collector } from './types.js';
import type { AggregatorMessage, FinanceData } from '../types.js';

const POLL_INTERVAL_MS = 1_800_000; // 30 minutes
const API_URL = 'https://api.exchangerate-api.com/v4/latest/JPY';

interface ExchangeRateResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

/**
 * Exchange rate collector -- polls JPY→TWD rate and broadcasts finance data.
 */
export function createExchangeRateCollector(): Collector {
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastRate: number | undefined;
  let lastPayloadJson = '';

  async function fetchRate(): Promise<FinanceData> {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as ExchangeRateResponse;
    const twdRate = body.rates['TWD'];

    if (twdRate === undefined) {
      throw new Error('TWD rate not found in API response');
    }

    const now = new Date().toISOString();
    const data: FinanceData = {
      jpyToTwd: twdRate,
      jpyToTwdPrev: lastRate,
      rateUpdatedAt: now,
      lastUpdated: now,
    };

    // Store current rate as previous for next poll
    lastRate = twdRate;

    return data;
  }

  return {
    name: 'exchange-rate',

    start(broadcast: (msg: AggregatorMessage) => void) {
      console.log('[exchange-rate] collector started, polling every 30min');

      const poll = async () => {
        try {
          const data = await fetchRate();
          const payloadJson = JSON.stringify(data);

          // Only broadcast if data actually changed
          if (payloadJson !== lastPayloadJson) {
            lastPayloadJson = payloadJson;
            broadcast({
              type: 'finance',
              data,
              timestamp: Date.now(),
            });
            console.log(`[exchange-rate] broadcast JPY→TWD = ${data.jpyToTwd}`);
          } else {
            console.log('[exchange-rate] no changes, skipping broadcast');
          }
        } catch (err) {
          console.error('[exchange-rate] poll error:', err instanceof Error ? err.message : err);
          // Will retry on next interval
        }
      };

      // Initial poll immediately
      void poll();
      timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      console.log('[exchange-rate] collector stopped');
    },
  };
}
