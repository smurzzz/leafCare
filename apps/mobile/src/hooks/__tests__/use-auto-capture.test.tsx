/**
 * The auto-capture loop (screen 09).
 *
 * The tracker decides *when* a plant is worth capturing; this decides whether the
 * loop around it behaves on a phone — it stops when the screen is off, it fires
 * once and then stops probing, a camera that fails does not kill it, and it gives
 * up rather than holding the lens open forever.
 *
 * Timings are compressed through the options object (`firstProbeMs`, `intervalMs`)
 * so the suite runs on real timers.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { type FrameSample } from '@/lib/frame-analysis';
import { probeFrame, type ProbeCamera } from '@/lib/frame-probe';
import { useAutoCapture } from '@/hooks/use-auto-capture';

jest.mock('@/lib/frame-probe', () => ({ probeFrame: jest.fn() }));

const probe = probeFrame as jest.MockedFunction<typeof probeFrame>;

const sample = (score: number, luma = 120): FrameSample => ({
  score,
  luma,
  coverage: score,
  detail: score,
});

const camera = { takePictureAsync: jest.fn() } as unknown as ProbeCamera;

// The screen hands over a `useRef` object, so the tests do the same: a fresh
// object per render would restart the loop on every render.
const cameraRef = { current: camera };
const emptyRef = { current: null };

const FAST = { firstProbeMs: 5, intervalMs: 10, stableFrames: 3, readyScore: 0.75 };

/** Probes answer with the given samples, in order, repeating the last one. */
const answers = (samples: FrameSample[]): void => {
  let index = 0;
  probe.mockImplementation(async () => {
    const value = samples[Math.min(index, samples.length - 1)] as FrameSample;
    index += 1;
    return value;
  });
};

beforeEach(() => {
  probe.mockReset();
  AppState.currentState = 'active';
});

describe('useAutoCapture', () => {
  it('is off, and never probes, when the screen says so', async () => {
    answers([sample(0.9)]);
    const onCapture = jest.fn();
    const { result } = await renderHook(() =>
      useAutoCapture({ cameraRef, enabled: false, onCapture, options: FAST }),
    );

    expect(result.current.status).toBe('off');
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(probe).not.toHaveBeenCalled();
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('captures once the plant has been centred and held, and stops probing after that', async () => {
    answers([sample(0.9, 120), sample(0.9, 121), sample(0.9, 122), sample(0.9, 123)]);
    const onCapture = jest.fn();
    const { result } = await renderHook(() =>
      useAutoCapture({ cameraRef, enabled: true, onCapture, options: FAST }),
    );

    // Wait on the state, not on the mock: the hook sets `capturing` and then
    // starts the capture, so the call can land a render before the screen shows
    // it — and this assertion is about what the screen shows.
    await waitFor(() => expect(result.current.status).toBe('capturing'));
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(result.current.progress).toBe(1);

    // Three steady frames were needed, not one, and nothing probed afterwards:
    // the camera is handed to the identifying screen.
    expect(probe).toHaveBeenCalledTimes(3);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(probe).toHaveBeenCalledTimes(3);
    expect(onCapture).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting while the frame is not a plant', async () => {
    answers([sample(0.2), sample(0.4)]);
    const onCapture = jest.fn();
    const { result } = await renderHook(() =>
      useAutoCapture({ cameraRef, enabled: true, onCapture, options: FAST }),
    );

    await waitFor(() => expect(probe.mock.calls.length).toBeGreaterThan(2));
    expect(result.current.status).toBe('searching');
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('survives a camera that throws, and still fires when the frame comes back', async () => {
    let calls = 0;
    probe.mockImplementation(async () => {
      calls += 1;
      if (calls <= 2) throw new Error('camera busy');
      return sample(0.95);
    });
    const onCapture = jest.fn();
    await renderHook(() =>
      useAutoCapture({ cameraRef, enabled: true, onCapture, options: FAST }),
    );

    // Two failures then three good frames: the failure cost time, not the feature.
    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
  });

  it('gives up instead of holding the camera open forever', async () => {
    answers([sample(0.1)]);
    const onCapture = jest.fn();
    const { result } = await renderHook(() =>
      useAutoCapture({
        cameraRef,
        enabled: true,
        onCapture,
        options: { ...FAST, intervalMs: 15, maxSearchMs: 50 },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('gaveUp'));
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('does not probe while the app is in the background', async () => {
    AppState.currentState = 'background';
    answers([sample(0.9)]);
    const onCapture = jest.fn();
    await renderHook(() =>
      useAutoCapture({ cameraRef, enabled: true, onCapture, options: FAST }),
    );

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(probe).not.toHaveBeenCalled();
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('does not probe when there is no camera to probe', async () => {
    answers([sample(0.9)]);
    const onCapture = jest.fn();
    await renderHook(() =>
      useAutoCapture({ cameraRef: emptyRef, enabled: true, onCapture, options: FAST }),
    );

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(probe).not.toHaveBeenCalled();
  });

  it('hands the preview aspect to the probe, which needs it to measure what the user sees', async () => {
    answers([sample(0.9)]);
    await renderHook(() =>
      useAutoCapture({
        cameraRef,
        enabled: true,
        onCapture: jest.fn(),
        options: FAST,
        viewAspect: 393 / 852,
      }),
    );

    await waitFor(() => expect(probe).toHaveBeenCalled());
    expect(probe).toHaveBeenCalledWith(camera, { viewAspect: 393 / 852 });
  });

  it('says it cannot see the frame when no probe measures anything, and keeps looking', async () => {
    // A build without the native modules, or a camera refusing every capture, used to
    // be indistinguishable from "no plant yet": the same caption, indefinitely.
    probe.mockResolvedValue(null);
    const onCapture = jest.fn();
    const { result } = await renderHook(() =>
      useAutoCapture({ cameraRef, enabled: true, onCapture, options: FAST }),
    );

    await waitFor(() => expect(result.current.status).toBe('blind'));
    expect(onCapture).not.toHaveBeenCalled();

    // It keeps probing rather than giving up: a camera that comes back is picked up
    // without the user having to leave the screen.
    const seen = probe.mock.calls.length;
    await waitFor(() => expect(probe.mock.calls.length).toBeGreaterThan(seen));
  });

  it('stops reporting blind as soon as a frame arrives', async () => {
    // Flipped by the test rather than by a probe count: `blind` is a state the user
    // stays in until measuring works again, and a counter would race the assertion.
    let measuring = false;
    probe.mockImplementation(async () => (measuring ? sample(0.9) : null));
    const { result } = await renderHook(() =>
      useAutoCapture({ cameraRef, enabled: true, onCapture: jest.fn(), options: FAST }),
    );

    await waitFor(() => expect(result.current.status).toBe('blind'));
    measuring = true;
    await waitFor(() => expect(result.current.status).not.toBe('blind'));
  });
});
