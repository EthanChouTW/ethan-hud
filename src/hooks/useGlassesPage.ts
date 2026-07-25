import { useEffect, useRef } from 'react';
import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerUpgrade,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import {
  buildContainerPayload,
  HEADER_CONTAINER_ID,
  HEADER_CONTAINER_NAME,
  type GlassesPage,
} from '../glasses/page';

/**
 * Push a page to the glasses, keeping the native containers in sync with the
 * current card.
 *
 * `createStartUpPageContainer` is mandatory on launch -- without it the
 * glasses sit on the "launch app" screen and no later call renders anything.
 * Every subsequent change goes through `rebuildPageContainer`.
 *
 * Pushes are serialised: each one is a BLE round trip, and the page changes
 * far more often than the glasses can redraw. One worker loop owns the
 * transport and always re-reads the newest page, so an update that lands
 * mid-flight is picked up on the next iteration rather than dropped.
 *
 * The loop must NOT abort when the effect re-runs. An earlier version bound
 * it to a per-run `cancelled` flag, which raced: the cleanup cancelled the
 * running loop, while the new effect saw the loop still marked busy and
 * skipped its own push -- leaving the glasses frozen on the first page ever
 * rendered. Only unmount stops it.
 */
export function useGlassesPage(
  bridge: EvenAppBridge | null,
  page: GlassesPage,
): void {
  const createdRef = useRef(false);
  const lastSignatureRef = useRef<string>('');
  const lastRowsRef = useRef<string>('');
  const runningRef = useRef(false);
  const unmountedRef = useRef(false);

  // Always read the newest values inside the loop, not the ones captured when
  // a given effect run started.
  const latestPageRef = useRef(page);
  latestPageRef.current = page;
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!bridgeRef.current) return;
    // Safe to skip: the running loop re-reads latestPageRef and will push
    // this change before it exits.
    if (runningRef.current) return;

    runningRef.current = true;

    void (async () => {
      try {
        while (!unmountedRef.current) {
          const b = bridgeRef.current;
          if (!b) break;

          const current = latestPageRef.current;
          const signature = JSON.stringify(current);
          if (signature === lastSignatureRef.current) break;

          const payload = buildContainerPayload(current);
          const rowsKey = JSON.stringify(current.rows);

          // Fast path: only the header text changed (the connection flag
          // flicks between ws../ws on every reconnect). Rebuilding the whole
          // container tree for that is a wasted BLE round trip, and it is
          // what makes card switches feel like they stutter.
          if (createdRef.current && rowsKey === lastRowsRef.current) {
            const ok = await b.textContainerUpgrade(
              new TextContainerUpgrade({
                containerID: HEADER_CONTAINER_ID,
                containerName: HEADER_CONTAINER_NAME,
                content: current.title,
              }),
            );
            if (ok) {
              lastSignatureRef.current = signature;
              continue;
            }
            // Fall through to a full rebuild if the upgrade was refused.
          }

          if (!createdRef.current) {
            const result = await b.createStartUpPageContainer(
              new CreateStartUpPageContainer(payload),
            );
            if (result !== StartUpPageCreateResult.success) {
              console.error('[glasses] createStartUpPageContainer failed:', result);
              break;
            }
            createdRef.current = true;
            console.log('[glasses] startup page created');
          } else {
            const ok = await b.rebuildPageContainer(
              new RebuildPageContainer(payload),
            );
            if (!ok) {
              // A rejected rebuild leaves the *previous* page on the glasses,
              // which looks like "the card did not switch" rather than an
              // error. Fall back to a minimal page so the failure is visible.
              console.error('[glasses] rebuildPageContainer failed for', current.title);
              const fallback = await b.rebuildPageContainer(
                new RebuildPageContainer(
                  buildContainerPayload({
                    title: `${current.title} !render`,
                    rows: ['page rejected by host'],
                  }),
                ),
              );
              if (!fallback) console.error('[glasses] fallback rebuild failed too');
              break;
            }
          }

          lastSignatureRef.current = signature;
          lastRowsRef.current = rowsKey;
        }
      } catch (err) {
        console.error('[glasses] push error:', err);
      } finally {
        runningRef.current = false;
      }
    })();
  }, [bridge, page]);
}
