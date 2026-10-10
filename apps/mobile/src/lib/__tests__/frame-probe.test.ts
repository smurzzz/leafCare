/**
 * The camera probe.
 *
 * Two things have to hold on a real phone: the probe measures the frame the
 * analysis expects (a 64×64 PNG made from a fast capture), and it removes both
 * files it created — a probe runs about once a second, and every capture is a
 * full-resolution JPEG however low `quality` is.
 *
 * The camera, the resizer and the filesystem are all faked here; `probeFrame`
 * itself is the code under test, and the PNG it decodes is a real one.
 */

import { manipulateAsync } from 'expo-image-manipulator';
import * as UPNG from 'upng-js';

import {
  AUTO_CAPTURE_READY_SCORE,
  type RgbaImage,
} from '@/lib/frame-analysis';
import { PROBE_SIZE, probeFrame, type ProbeCamera } from '@/lib/frame-probe';

const mockDeleted: string[] = [];
const mockDeleteFails = { value: false };

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    delete() {
      if (mockDeleteFails.value) throw new Error('file has already been removed');
      mockDeleted.push(this.uri);
    }
  },
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { PNG: 'png' },
  manipulateAsync: jest.fn(),
}));

const manipulate = manipulateAsync as jest.MockedFunction<typeof manipulateAsync>;

/** A textured leaf close-up, encoded as a real PNG. */
const leafPng = (): string => {
  const size = PROBE_SIZE;
  const data = new Uint8Array(size * size * 4);
  for (let pixel = 0; pixel < size * size; pixel += 1) {
    const light = pixel % 2 === 0;
    data[pixel * 4] = light ? 27 : 124;
    data[pixel * 4 + 1] = light ? 94 : 179;
    data[pixel * 4 + 2] = light ? 32 : 66;
    data[pixel * 4 + 3] = 255;
  }
  const image: RgbaImage = { width: size, height: size, data };
  return Buffer.from(new Uint8Array(UPNG.encode([image.data.buffer], size, size, 0))).toString('base64');
};

const cameraReturning = (photo: { uri?: string } | undefined): ProbeCamera & {
  takePictureAsync: jest.Mock;
} => ({ takePictureAsync: jest.fn(async () => photo) });

beforeEach(() => {
  mockDeleted.length = 0;
  mockDeleteFails.value = false;
  manipulate.mockReset();
});

describe('probeFrame', () => {
  it('measures the frame and removes both files it created', async () => {
    const camera = cameraReturning({ uri: 'file:///cache/probe.jpg' });
    manipulate.mockResolvedValue({
      uri: 'file:///cache/probe-tiny.png',
      width: PROBE_SIZE,
      height: PROBE_SIZE,
      base64: leafPng(),
    });

    const sample = await probeFrame(camera);

    // A fast capture: the orientation pass is what makes a probe slow, and a
    // centre-box colour measurement does not care which way up the frame is.
    expect(camera.takePictureAsync).toHaveBeenCalledWith({
      quality: 0.2,
      skipProcessing: true,
      exif: false,
    });
    expect(manipulate).toHaveBeenCalledWith(
      'file:///cache/probe.jpg',
      [{ resize: { width: PROBE_SIZE, height: PROBE_SIZE } }],
      { base64: true, format: 'png' },
    );
    expect(sample?.score).toBeGreaterThanOrEqual(AUTO_CAPTURE_READY_SCORE);
    expect(mockDeleted).toEqual(['file:///cache/probe.jpg', 'file:///cache/probe-tiny.png']);
  });

  it('returns null when the camera delivers no file', async () => {
    const camera = cameraReturning(undefined);
    await expect(probeFrame(camera)).resolves.toBeNull();
    expect(manipulate).not.toHaveBeenCalled();
    expect(mockDeleted).toEqual([]);
  });

  it('returns null when the thumbnail carries no pixels, and still cleans up', async () => {
    const camera = cameraReturning({ uri: 'file:///cache/probe.jpg' });
    manipulate.mockResolvedValue({
      uri: 'file:///cache/probe-tiny.png',
      width: PROBE_SIZE,
      height: PROBE_SIZE,
      base64: undefined,
    });

    await expect(probeFrame(camera)).resolves.toBeNull();
    expect(mockDeleted).toEqual(['file:///cache/probe.jpg', 'file:///cache/probe-tiny.png']);
  });

  it('lets a resizer failure through but never leaks the capture', async () => {
    const camera = cameraReturning({ uri: 'file:///cache/probe.jpg' });
    manipulate.mockRejectedValue(new Error('manipulator is unhappy'));

    // The caller catches this and keeps the camera screen working.
    await expect(probeFrame(camera)).rejects.toThrow('manipulator is unhappy');
    expect(mockDeleted).toEqual(['file:///cache/probe.jpg']);
  });

  it('still returns a sample when the filesystem refuses to delete', async () => {
    const camera = cameraReturning({ uri: 'file:///cache/probe.jpg' });
    manipulate.mockResolvedValue({
      uri: 'file:///cache/probe-tiny.png',
      width: PROBE_SIZE,
      height: PROBE_SIZE,
      base64: leafPng(),
    });
    mockDeleteFails.value = true;

    const sample = await probeFrame(camera);
    expect(sample?.coverage).toBe(1);
  });
});
