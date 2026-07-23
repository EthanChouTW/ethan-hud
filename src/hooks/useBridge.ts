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

/**
 * React hook wrapping the Even Hub SDK bridge lifecycle.
 *
 * - Awaits bridge readiness
 * - Subscribes to device status + launch source
 * - Subscribes to EvenHub events for G2 touch bar navigation
 * - Exposes connection/battery state for HUD status bar
 *
 * @param onNavigate  optional callback for touch-bar scroll (left/right)
 * @param onTap       optional callback for single tap
 * @param onDoubleTap optional callback for double tap
 */
export function useBridge(
  onNavigate?: (direction: 'left' | 'right') => void,
  onTap?: () => void,
  onDoubleTap?: () => void,
): BridgeState {
  const [bridge, setBridge] = useState<EvenAppBridge | null>(null);
  const [ready, setReady] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | undefined>();
  const [launchSource, setLaunchSource] = useState<LaunchSource | null>(null);

  // Stable refs so the EvenHub callback always sees the latest handler
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;
  const tapRef = useRef(onTap);
  tapRef.current = onTap;
  const doubleTapRef = useRef(onDoubleTap);
  doubleTapRef.current = onDoubleTap;

  // Debounce guard for rapid scroll events
  const lastScrollRef = useRef(0);

  const handleEvenHubEvent = useCallback((event: EvenHubEvent) => {
    // Touch bar events arrive as sysEvent (from glasses temple) or
    // listEvent (scroll within an OS list container). We handle both.
    const sysEvt = event.sysEvent;
    if (sysEvt?.eventType !== undefined) {
      const now = Date.now();

      switch (sysEvt.eventType) {
        case OsEventTypeList.SCROLL_BOTTOM_EVENT:
          // Scroll forward -> next card
          if (now - lastScrollRef.current >= TOUCH_DEBOUNCE_MS) {
            lastScrollRef.current = now;
            navigateRef.current?.('right');
          }
          break;
        case OsEventTypeList.SCROLL_TOP_EVENT:
          // Scroll backward -> previous card
          if (now - lastScrollRef.current >= TOUCH_DEBOUNCE_MS) {
            lastScrollRef.current = now;
            navigateRef.current?.('left');
          }
          break;
        case OsEventTypeList.CLICK_EVENT:
          tapRef.current?.();
          break;
        case OsEventTypeList.DOUBLE_CLICK_EVENT:
          doubleTapRef.current?.();
          break;
      }
    }

    // List scroll events (from OS list containers) can also navigate
    const listEvt = event.listEvent;
    if (listEvt?.eventType !== undefined) {
      const now = Date.now();
      if (
        listEvt.eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT &&
        now - lastScrollRef.current >= TOUCH_DEBOUNCE_MS
      ) {
        lastScrollRef.current = now;
        navigateRef.current?.('right');
      } else if (
        listEvt.eventType === OsEventTypeList.SCROLL_TOP_EVENT &&
        now - lastScrollRef.current >= TOUCH_DEBOUNCE_MS
      ) {
        lastScrollRef.current = now;
        navigateRef.current?.('left');
      }
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

  // Fallback: browser wheel/touch events for dev and WebView passthrough.
  // The G2 WebView may translate temple scrolls into standard wheel events.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollRef.current < TOUCH_DEBOUNCE_MS) return;
      lastScrollRef.current = now;

      // deltaY > 0 = scroll down = next card
      if (e.deltaY > 0 || e.deltaX > 0) {
        navigateRef.current?.('right');
      } else if (e.deltaY < 0 || e.deltaX < 0) {
        navigateRef.current?.('left');
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  return { bridge, ready, deviceConnected, batteryLevel, launchSource };
}
