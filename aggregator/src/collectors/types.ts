import type { AggregatorMessage } from '../types.js';

export interface Collector {
  name: string;
  start(broadcast: (msg: AggregatorMessage) => void): void;
  stop(): void;
  handleAction?(action: string, payload: Record<string, unknown>): Promise<void>;
}
