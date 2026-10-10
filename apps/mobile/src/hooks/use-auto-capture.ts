/**
 * The auto-capture loop behind screen 09.
 *
 * A `setTimeout` chain rather than `setInterval`: a probe takes as long as the
 * camera needs, and an interval would stack probes on a slow device. Each tick
 * is scheduled only after the previous one finishes.
 *
 * Three guards that all matter on a real phone:
 *   - nothing is probed while the app is in the background (`AppState`), or the
 *     camera keeps working for a photo nobody can see;
 *   - a failing probe is swallowed and the loop continues, so one bad frame never
 *     kills auto-capture or surfaces as an error;
 *   - after `maxSearchMs` the loop reports `gaveUp` and stops. Probing is real
 *     camera work and real battery; a user who cannot get a plant into the frame
 *     is better served by the shutter than by a camera that never stops.
 *
 * The status the screen renders is *derived*: `off` comes from `enabled`, not from
 * state. That keeps the effect body free of synchronous `setState` calls (which
 * cascade renders), and means switching auto-capture off can never leave a stale
 * "capturing" on screen.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  AUTO_CAPTURE_DEFAULTS,
  createAutoCapture,
  type AutoCaptureOptions,
} from '@/lib/auto-capture';
import { probeFrame, type ProbeCamera } from '@/lib/frame-probe';

export type AutoCaptureStatus =
  /** Auto-capture is switched off: screen 09 behaves exactly as the PNG shows it. */
  | 'off'
  | 'searching'
  | 'holding'
  | 'ready'
  | 'capturing'
  | 'gaveUp';

export type AutoCaptureState = {
  status: AutoCaptureStatus;
  /** 0–1: how close the frame is to firing. Drives the ring around the frame. */
  progress: number;
};

export type UseAutoCaptureOptions = {
  cameraRef: React.RefObject<ProbeCamera | null>;
  /** Off when the toggle is off, the screen is blurred, or the permission is missing. */
  enabled: boolean;
  /** Fires once per armed cycle: capture at full quality and navigate away. */
  onCapture: () => Promise<void> | void;
  /** Read once per armed cycle; changing it does not restart a running loop. */
  options?: Partial<AutoCaptureOptions>;
};

type LoopState = { status: Exclude<AutoCaptureStatus, 'off'>; progress: number };

export const useAutoCapture = ({
  cameraRef,
  enabled,
  onCapture,
  options,
}: UseAutoCaptureOptions): AutoCaptureState => {
  const [loop, setLoop] = useState<LoopState>({ status: 'searching', progress: 0 });

  // Refs, so the loop never has to restart because a callback, an options object
  // or the camera ref itself was recreated by the screen's next render. The camera
  // ref is wrapped rather than depended on: a caller passing an inline
  // `{ current: camera }` would otherwise restart the effect on every render, and
  // the loop would then never let the component settle.
  const cameraRefRef = useRef(cameraRef);
  const captureRef = useRef(onCapture);
  const configRef = useRef({ ...AUTO_CAPTURE_DEFAULTS, ...(options ?? {}) });

  useEffect(() => {
    cameraRefRef.current = cameraRef;
    captureRef.current = onCapture;
    configRef.current = { ...AUTO_CAPTURE_DEFAULTS, ...(options ?? {}) };
  });

  useEffect(() => {
    if (!enabled) return;

    const config = configRef.current;
    const tracker = createAutoCapture(config);
    const startedAt = Date.now();
    let cancelled = false;
    let first = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async (): Promise<void> => {
      if (cancelled) return;

      // Reset the ring at the start of a cycle. Done here, inside a timer
      // callback, rather than in the effect body, which must not set state.
      if (first) {
        first = false;
        setLoop({ status: 'searching', progress: 0 });
      }

      if (Date.now() - startedAt > config.maxSearchMs) {
        setLoop({ status: 'gaveUp', progress: 1 });
        return;
      }

      const camera = AppState.currentState === 'active' ? cameraRefRef.current.current : null;
      if (camera) {
        const sample = await probeFrame(camera).catch(() => null);
        if (cancelled) return;

        if (sample) {
          const verdict = tracker.push(sample);
          if (verdict.fire) {
            setLoop({ status: 'capturing', progress: 1 });
            await Promise.resolve(captureRef.current()).catch(() => undefined);
            return;
          }
          // `captured` is unreachable here (it is always a `fire` frame) but the
          // mapping is explicit so a new status cannot leak into the UI type.
          const status: LoopState['status'] =
            verdict.status === 'holding'
              ? 'holding'
              : verdict.status === 'ready'
                ? 'ready'
                : 'searching';
          setLoop({ status, progress: verdict.progress });
        }
      }

      if (!cancelled) timer = setTimeout(() => void tick(), config.intervalMs);
    };

    // A beat before the first probe: the preview needs a moment to expose, and a
    // frame grabbed immediately after mount is usually black.
    timer = setTimeout(() => void tick(), config.firstProbeMs);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  return enabled ? loop : { status: 'off', progress: 0 };
};
