import { useEffect, useRef, useState, useCallback } from 'react';
import type { AggregatorMessage } from '../types/dashboard';

const DEFAULT_WS_URL = 'ws://ethan-mac-mini.local:8080';
const RECONNECT_INTERVAL_MS = 5000;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseWebSocketReturn {
  status: ConnectionStatus;
  lastMessage: AggregatorMessage | null;
  send: (data: string) => void;
}

/**
 * WebSocket hook for connecting to the Mac mini aggregator.
 *
 * Handles auto-reconnect and exposes connection status so cards can
 * show a "disconnected" indicator when the aggregator is unreachable.
 */
export function useWebSocket(url: string = DEFAULT_WS_URL): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<AggregatorMessage | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg: AggregatorMessage = JSON.parse(event.data);
        setLastMessage(msg);
      } catch {
        console.warn('[useWebSocket] Failed to parse message:', event.data);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, RECONNECT_INTERVAL_MS);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { status, lastMessage, send };
}
