import { useEffect, useRef, useState, useCallback } from 'react';
import type { AggregatorMessage } from '../types/dashboard';

const WS_PORT = 9500;
const RECONNECT_INTERVAL_MS = 5000;

/**
 * Build the aggregator WebSocket URL.
 *
 * Three cases, in priority order:
 *
 * 1. `VITE_WS_URL` baked in at build time -- required for packed .ehpk
 *    builds, where the page is served from a local bundle and its hostname
 *    tells us nothing about where the Mac is.
 * 2. QR sideload -- the page comes from the Vite dev server on the Mac, so
 *    its hostname is also where the aggregator runs.
 * 3. Local browser dev -- localhost.
 *
 * Hardcoding localhost breaks the phone WebView, where localhost is the
 * phone itself.
 */
function defaultWsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured;

  const host = window.location.hostname;
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return `ws://localhost:${WS_PORT}`;
  }
  return `ws://${host}:${WS_PORT}`;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseWebSocketReturn {
  status: ConnectionStatus;
  send: (data: string) => void;
}

/**
 * WebSocket hook for connecting to the Mac mini aggregator.
 *
 * Handles auto-reconnect and exposes connection status so cards can
 * show a "disconnected" indicator when the aggregator is unreachable.
 *
 * Messages are delivered through `onMessage` rather than held in state. The
 * aggregator replays every collector's latest payload back-to-back the moment
 * a client connects, so several messages land in a single React batch -- a
 * `lastMessage` state would keep only the final one and silently drop the
 * rest. That is exactly what happened: tasks and finance arrived before
 * calendar and were overwritten before any render could read them.
 */
export function useWebSocket(
  onMessage?: (msg: AggregatorMessage) => void,
  url: string = defaultWsUrl(),
): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  // Ref so a changing handler never tears down the socket.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

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
        onMessageRef.current?.(msg);
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

  return { status, send };
}
