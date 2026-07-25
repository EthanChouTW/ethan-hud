import { useEffect, useRef, useState, useCallback } from 'react';
import {
  waitForEvenAppBridge,
  type EvenAppBridge,
  type DeviceStatus,
  type LaunchSource,
  type EvenHubEvent,
  DeviceConnectType,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk';

const TOUCH_DEBOUNCE_MS = 200;

interface BridgeState {
  bridge: EvenAppBridge | null;
  ready: boolean;
  deviceConnected: boolean;
  batteryLevel: number | undefined;
  launchSource: LaunchSource | null;
}

interface BridgeHandlers {
  /** Card switch. On glasses this is double-tap; in the browser, arrow keys. */
  onNavigate?: (direction: 'left' | 'right') => void;
  /** Act on the selected row. */
  onTap?: () => void;
  /** Absolute row selection, reported by the native list container. */
  onSelect?: (index: number) => void;
  /** Relative selection move, from a raw scroll event. */
  onScroll?: (delta: 1 | -1) => void;
  /** Last raw event, for on-glasses diagnostics. */
  onRawEvent?: (label: string) => void;
}

/**
 * React hook wrapping the Even Hub SDK bridge lifecycle.
 *
 * Event model on the glasses: the list container is created with
 * `isEventCapture: 1`, so the temple scroll drives native row selection and
 * reaches us as `listEvent` rather than as a scroll we handle ourselves. That
 * leaves tap for "act on selection" and double-tap for "next card".
 */
export function useBridge(handlers: BridgeHandlers = {}): BridgeState {
  const [bridge, setBridge] = useState<EvenAppBridge | null>(null);
  const [ready, setReady] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | undefined>();
  const [launchSource, setLaunchSource] = useState<LaunchSource | null>(null);

  // Stable ref so the EvenHub callback always sees the latest handlers
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const lastTouchRef = useRef(0);
  const lastIndexRef = useRef<number | undefined>(undefined);
  const eventSeqRef = useRef(0);

  const handleEvenHubEvent = useCallback((event: EvenHubEvent) => {
    const h = handlersRef.current;
    const listEvt = event.listEvent;
    const sysEvt = event.sysEvent;

    const eventType = listEvt?.eventType ?? sysEvt?.eventType;
    const index = listEvt?.currentSelectItemIndex;

    // Report before any filtering, so an event dropped by the debounce -- or
    // carrying a code we do not handle -- is still visible rather than
    // looking like nothing arrived. The sequence number makes repeats of an
    // identical event distinguishable on the display.
    eventSeqRef.current += 1;
    h.onRawEvent?.(
      [
        `#${eventSeqRef.current % 100}`,
        listEvt?.eventType !== undefined ? `L${listEvt.eventType}` : '',
        sysEvt?.eventType !== undefined ? `S${sysEvt.eventType}` : '',
        index !== undefined ? `i${index}` : '',
        listEvt && listEvt.eventType === undefined && index === undefined ? 'bare' : '',
      ].filter(Boolean).join(''),
    );

    const now = Date.now();
    if (now - lastTouchRef.current < TOUCH_DEBOUNCE_MS) return;

    // Observed on the G2: the list reports a tap with no eventType at all --
    // just a selection payload. A tap on an already-selected row carries no
    // index either. So the event type cannot be what distinguishes tap from
    // scroll; the index moving is.
    //
    // Index changed  -> the temple scrolled, move the selection.
    // Index same/absent -> the row was activated, treat as a tap.
    if (eventType === undefined) {
      if (!listEvt) return;
      lastTouchRef.current = now;

      if (index !== undefined && index !== lastIndexRef.current) {
        lastIndexRef.current = index;
        h.onSelect?.(index);
      } else {
        h.onTap?.();
      }
      return;
    }

    lastTouchRef.current = now;

    switch (eventType) {
      case OsEventTypeList.CLICK_EVENT:
        h.onTap?.();
        break;
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        h.onNavigate?.('right');
        break;
      case OsEventTypeList.SCROLL_BOTTOM_EVENT:
        if (index === undefined) h.onScroll?.(1);
        else { lastIndexRef.current = index; h.onSelect?.(index); }
        break;
      case OsEventTypeList.SCROLL_TOP_EVENT:
        if (index === undefined) h.onScroll?.(-1);
        else { lastIndexRef.current = index; h.onSelect?.(index); }
        break;
    }
  }, []);

  useEffect(() => {
    let unsubStatus: (() => void) | undefined;
    let unsubLaunch: (() => void) | undefined;
    let unsubHub: (() => void) | undefined;

    waitForEvenAppBridge()
      .then((b) => {
        setBridge(b);
        setReady(true);

        unsubStatus = b.onDeviceStatusChanged((status: DeviceStatus) => {
          setDeviceConnected(status.connectType === DeviceConnectType.Connected);
          setBatteryLevel(status.batteryLevel);
        });

        unsubLaunch = b.onLaunchSource((source: LaunchSource) => {
          setLaunchSource(source);
        });

        unsubHub = b.onEvenHubEvent(handleEvenHubEvent);
      })
      .catch((err) => {
        console.warn('[useBridge] Bridge init failed (expected outside Even App):', err);
      });

    return () => {
      unsubStatus?.();
      unsubLaunch?.();
      unsubHub?.();
    };
  }, [handleEvenHubEvent]);

  // Browser dev fallback: mouse wheel switches cards.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastTouchRef.current < TOUCH_DEBOUNCE_MS) return;
      lastTouchRef.current = now;

      if (e.deltaY > 0 || e.deltaX > 0) {
        handlersRef.current.onNavigate?.('right');
      } else if (e.deltaY < 0 || e.deltaX < 0) {
        handlersRef.current.onNavigate?.('left');
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  return { bridge, ready, deviceConnected, batteryLevel, launchSource };
}
