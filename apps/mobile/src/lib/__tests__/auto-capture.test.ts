/**
 * The auto-capture decision.
 *
 * The rules that matter on a phone: never fire on one lucky frame, never fire
 * while the phone is still moving, never fire twice for one plant, and go back to
 * waiting when the frame stops being a plant.
 */

import { createAutoCapture, type AutoCaptureOptions } from '@/lib/auto-capture';

const CONFIG: Partial<AutoCaptureOptions> = { readyScore: 0.75, stableFrames: 3, motionTolerance: 6 };

const good = (luma = 120) => ({ score: 0.9, luma });
const poor = (luma = 120) => ({ score: 0.3, luma });

describe('createAutoCapture', () => {
  it('waits for a plant: a poor frame is searching and resets the run', () => {
    const tracker = createAutoCapture(CONFIG);
    expect(tracker.push(poor())).toMatchObject({ status: 'searching', steady: 0, fire: false });
    tracker.push(good());
    tracker.push(good());
    expect(tracker.push(poor())).toMatchObject({ status: 'searching', steady: 0, fire: false });
  });

  it('does not fire on one good frame', () => {
    const tracker = createAutoCapture(CONFIG);
    expect(tracker.push(good())).toMatchObject({ status: 'ready', steady: 1, fire: false });
    expect(tracker.push(good())).toMatchObject({ status: 'ready', steady: 2, fire: false });
  });

  it('fires on the third consecutive ready frame, and the ring is full only then', () => {
    const tracker = createAutoCapture(CONFIG);
    const first = tracker.push(good());
    const second = tracker.push(good());
    const third = tracker.push(good());

    expect(first.progress).toBeLessThan(0.8);
    expect(second.progress).toBeGreaterThan(first.progress);
    expect(third).toMatchObject({ status: 'captured', steady: 3, fire: true });
    expect(third.progress).toBe(1);
  });

  it('fires once per armed cycle even if the loop keeps probing', () => {
    const tracker = createAutoCapture(CONFIG);
    tracker.push(good());
    tracker.push(good());
    expect(tracker.push(good()).fire).toBe(true);
    expect(tracker.push(good())).toEqual({ status: 'captured', steady: 3, progress: 1, fire: false });
    expect(tracker.push(poor()).fire).toBe(false);
  });

  it('re-arms after reset, so the next plant can be captured', () => {
    const tracker = createAutoCapture(CONFIG);
    tracker.push(good());
    tracker.push(good());
    tracker.push(good());
    tracker.reset();
    expect(tracker.push(good())).toMatchObject({ status: 'ready', steady: 1, fire: false });
    tracker.push(good());
    expect(tracker.push(good()).fire).toBe(true);
  });

  it('reports a moving phone as holding, and restarts the count', () => {
    const tracker = createAutoCapture(CONFIG);
    tracker.push(good(100));
    tracker.push(good(100));
    // 20 luma in one frame is far more than handheld drift.
    expect(tracker.push(good(120))).toMatchObject({ status: 'holding', steady: 0, fire: false });
    expect(tracker.push(good(120))).toMatchObject({ status: 'ready', steady: 1 });
  });

  it('does not read the first frame as motion', () => {
    const tracker = createAutoCapture(CONFIG);
    expect(tracker.push(good(4))).toMatchObject({ status: 'ready', fire: false });
  });

  it('accepts a small drift while the phone is held', () => {
    const tracker = createAutoCapture(CONFIG);
    tracker.push(good(100));
    tracker.push(good(104));
    // 4 luma per frame is a hand holding still, not a hand repositioning.
    expect(tracker.push(good(108))).toMatchObject({ status: 'captured', steady: 3, fire: true });
  });

  it('fills the ring as the frame approaches the bar', () => {
    const tracker = createAutoCapture(CONFIG);
    const far = tracker.push({ score: 0.1, luma: 100 });
    const near = tracker.push({ score: 0.6, luma: 100 });
    expect(far.progress).toBeLessThan(near.progress);
    expect(near.progress).toBeLessThanOrEqual(0.5);
  });

  it('honours overrides, which is how the thresholds were tuned', () => {
    const eager = createAutoCapture({ ...CONFIG, stableFrames: 1 });
    expect(eager.push(good()).fire).toBe(true);

    const strict = createAutoCapture({ ...CONFIG, readyScore: 0.95 });
    expect(strict.push(good()).status).toBe('searching');
  });

  it('defaults to the calibrated thresholds', () => {
    // Guards against the defaults drifting away from the values the real-photo
    // calibration in docs/testing.md was done with.
    const tracker = createAutoCapture();
    expect(tracker.push({ score: 0.7, luma: 100 }).status).toBe('searching');
    tracker.push({ score: 0.9, luma: 100 });
    tracker.push({ score: 0.9, luma: 100 });
    expect(tracker.push({ score: 0.9, luma: 100 }).fire).toBe(true);
  });
});
