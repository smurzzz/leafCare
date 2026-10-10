/**
 * Auto-capture: the decision to fire the shutter without a tap.
 *
 * `frame-analysis.ts` says how plant-like one frame is; this says when to stop
 * looking and take the photo. Kept separate — and pure — because the timing is
 * the part that is easy to get wrong (firing on a single lucky frame, firing on a
 * blurred frame while the phone is still moving, firing twice for one plant) and
 * because it can then be tested without a camera.
 *
 * The rules, in order:
 *   1. A frame below `readyScore` is background: the run resets.
 *   2. A frame that moved too much since the last one resets the run and is
 *      reported as `holding` — the phone is being repositioned, so the copy can
 *      say "Hold still" instead of leaving the user guessing why nothing happens.
 *   3. `stableFrames` frames in a row that are both ready and steady fire once.
 *      One frame is not enough: it is the frame *after* the user settles.
 */

import { AUTO_CAPTURE_READY_SCORE, type FrameSample } from './frame-analysis';

export type AutoCaptureOptions = {
  /** Minimum frame score before the frame counts at all. */
  readyScore: number;
  /** Consecutive ready-and-steady frames required before firing. */
  stableFrames: number;
  /** Mean-luma change between frames above which the phone counts as moving. */
  motionTolerance: number;
  /** How long to wait before the first probe: the preview needs a moment to expose. */
  firstProbeMs: number;
  /** How often a frame is probed. A probe costs real camera time, so this is slow. */
  intervalMs: number;
  /** Give up probing after this long and leave the shutter to the user. */
  maxSearchMs: number;
};

export const AUTO_CAPTURE_DEFAULTS: AutoCaptureOptions = {
  readyScore: AUTO_CAPTURE_READY_SCORE,
  stableFrames: 3,
  // Handheld luma drift is not measurable off-device; this is the threshold to
  // tune first if auto-capture fires on blurred frames or never fires at all.
  motionTolerance: 6,
  firstProbeMs: 700,
  intervalMs: 1100,
  maxSearchMs: 60_000,
};

export type AutoCaptureStatus = 'searching' | 'holding' | 'ready' | 'captured';

export type AutoCaptureVerdict = {
  status: AutoCaptureStatus;
  /** Consecutive ready-and-steady frames counted so far. */
  steady: number;
  /** 0–1, drives the ring around the on-screen frame. */
  progress: number;
  /** True on exactly one frame per armed cycle: the frame to capture. */
  fire: boolean;
};

export type AutoCaptureReading = Pick<FrameSample, 'score' | 'luma'>;

export type AutoCaptureTracker = {
  push: (reading: AutoCaptureReading) => AutoCaptureVerdict;
  reset: () => void;
};

export const createAutoCapture = (
  overrides: Partial<AutoCaptureOptions> = {},
): AutoCaptureTracker => {
  const options: AutoCaptureOptions = { ...AUTO_CAPTURE_DEFAULTS, ...overrides };

  let steady = 0;
  let previousLuma: number | null = null;
  let captured = false;

  const reset = (): void => {
    steady = 0;
    previousLuma = null;
    captured = false;
  };

  const push = (reading: AutoCaptureReading): AutoCaptureVerdict => {
    // Latched: a burst of probes after the capture cannot fire a second time.
    if (captured) return { status: 'captured', steady, progress: 1, fire: false };

    const motion = previousLuma === null ? 0 : Math.abs(reading.luma - previousLuma);
    previousLuma = reading.luma;

    if (reading.score < options.readyScore) {
      steady = 0;
      // Half the ring fills as the frame approaches the bar, so a plant that is
      // nearly centred visibly moves the ring instead of nothing happening.
      const approach = (reading.score / options.readyScore) * 0.5;
      return { status: 'searching', steady, progress: Math.min(0.5, approach), fire: false };
    }

    if (motion > options.motionTolerance) {
      steady = 0;
      return { status: 'holding', steady, progress: 0.6, fire: false };
    }

    steady += 1;
    if (steady >= options.stableFrames) {
      captured = true;
      steady = options.stableFrames;
      return { status: 'captured', steady, progress: 1, fire: true };
    }

    return {
      status: 'ready',
      steady,
      progress: 0.6 + 0.4 * (steady / options.stableFrames),
      fire: false,
    };
  };

  return { push, reset };
};
