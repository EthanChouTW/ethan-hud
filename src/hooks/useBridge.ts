import { useEffect, useState } from 'react';
import {
  waitForEvenAppBridge,
  type EvenAppBridge,
  type DeviceStatus,
  type LaunchSource,
  DeviceConnectType,
} from '@evenrealities/even_hub_sdk';

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
 * - Exposes connection/battery state for HUD status bar
 */
export function useBridge(): BridgeState {
  const [bridge, setBridge] = useState<EvenAppBridge | null>(null);
  const [ready, setReady] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | undefined>();
  const [launchSource, setLaunchSource] = useState<LaunchSource | null>(null);

  useEffect(() => {
    let unsubStatus: (() => void) | undefined;
    let unsubLaunch: (() => void) | undefined;

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
      })
      .catch((err) => {
        console.warn('[useBridge] Bridge init failed (expected outside Even App):', err);
      });

    return () => {
      unsubStatus?.();
      unsubLaunch?.();
    };
  }, []);

  return { bridge, ready, deviceConnected, batteryLevel, launchSource };
}
