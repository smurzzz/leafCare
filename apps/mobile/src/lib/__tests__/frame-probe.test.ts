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
  analyzeFrame,
  type RgbaImage,
} from '@/lib/frame-analysis';
import {
  PROBE_SIZE,
  previewSquare,
  probeFrame,
  type CropRect,
  type ProbeCamera,
} from '@/lib/frame-probe';

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

const cameraReturning = (photo: { uri?: string; width?: number; height?: number } | undefined):
  ProbeCamera & { takePictureAsync: jest.Mock } => ({ takePictureAsync: jest.fn(async () => photo) });

/** An iPhone-14/15-shaped preview: 393×852 logical points. */
const VIEW_ASPECT = 393 / 852;

/** A 4:3 sensor frame, the aspect almost every phone camera delivers. */
const SENSOR = { width: 240, height: 180 };

/**
 * A box filter, which is what a device resize is close enough to for a measurement
 * that only counts colours and adjacent-pixel contrast. Non-uniform when given both
 * dimensions: the pre-fix probe stretched the whole frame to 64×64 regardless of its
 * aspect, and the comparison below has to do the same to be honest.
 */
const resizeTo = (image: RgbaImage, width: number, height: number): RgbaImage => {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor((x * image.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * image.width) / width));
      const y0 = Math.floor((y * image.height) / height);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * image.height) / height));
      const sums = [0, 0, 0];
      let count = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const index = (sy * image.width + sx) * 4;
          sums[0] += image.data[index] ?? 0;
          sums[1] += image.data[index + 1] ?? 0;
          sums[2] += image.data[index + 2] ?? 0;
          count += 1;
        }
      }
      const out = (y * width + x) * 4;
      data[out] = Math.round((sums[0] ?? 0) / count);
      data[out + 1] = Math.round((sums[1] ?? 0) / count);
      data[out + 2] = Math.round((sums[2] ?? 0) / count);
      data[out + 3] = 255;
    }
  }
  return { width, height, data };
};

const cropImage = (image: RgbaImage, rect: CropRect): RgbaImage => {
  const data = new Uint8Array(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y += 1) {
    for (let x = 0; x < rect.width; x += 1) {
      const from = ((rect.originY + y) * image.width + rect.originX + x) * 4;
      const to = (y * rect.width + x) * 4;
      data[to] = image.data[from] ?? 0;
      data[to + 1] = image.data[from + 1] ?? 0;
      data[to + 2] = image.data[from + 2] ?? 0;
      data[to + 3] = 255;
    }
  }
  return { width: rect.width, height: rect.height, data };
};

/** Leaf-coloured checkerboard (a leaf close-up at 64×64 is colour + adjacency contrast). */
const LEAF = [40, 110, 45] as const;
const LEAF_LIGHT = [120, 175, 70] as const;
const WALL = [141, 110, 99] as const;

/**
 * A sensor frame with a leaf framed where the on-screen guide is: a centred square.
 *
 * The guide is 280 pt of the 393 pt-wide preview, and the preview shows a 0.46-aspect
 * centre crop of a 1.33-aspect frame — so a plant that fills the guide covers only
 * `0.712 × 0.46 ≈ 33%` of the frame's width and height. That is the shot the user
 * takes when the caption tells them to fill the frame.
 */
const framedLeaf = (side: number): RgbaImage => {
  const image: RgbaImage = {
    width: SENSOR.width,
    height: SENSOR.height,
    data: new Uint8Array(SENSOR.width * SENSOR.height * 4),
  };
  const x0 = Math.round((SENSOR.width - side) / 2);
  const y0 = Math.round((SENSOR.height - side) / 2);
  for (let y = 0; y < SENSOR.height; y += 1) {
    for (let x = 0; x < SENSOR.width; x += 1) {
      const inLeaf = x >= x0 && x < x0 + side && y >= y0 && y < y0 + side;
      const colour = inLeaf && x % 2 === 0 ? LEAF : inLeaf ? LEAF_LIGHT : WALL;
      const index = (y * SENSOR.width + x) * 4;
      image.data[index] = colour[0];
      image.data[index + 1] = colour[1];
      image.data[index + 2] = colour[2];
      image.data[index + 3] = 255;
    }
  }
  return image;
};

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

  it('crops the capture to the square the preview shows before measuring it', async () => {
    const camera = cameraReturning({ uri: 'file:///cache/probe.jpg', ...SENSOR });
    manipulate.mockResolvedValue({
      uri: 'file:///cache/probe-tiny.png',
      width: PROBE_SIZE,
      height: PROBE_SIZE,
      base64: leafPng(),
    });

    await probeFrame(camera, { viewAspect: VIEW_ASPECT });

    // min(240, 180) × min(0.46, 1/0.46) = 83 px, centred in the 240×180 frame.
    expect(manipulate).toHaveBeenCalledWith(
      'file:///cache/probe.jpg',
      [
        { crop: { originX: 79, originY: 49, width: 83, height: 83 } },
        { resize: { width: PROBE_SIZE, height: PROBE_SIZE } },
      ],
      { base64: true, format: 'png' },
    );
  });

  it('measures the whole frame when the capture does not report its size', async () => {
    // Some cameras write no TAG_IMAGE_WIDTH, and skipProcessing reads the dimensions
    // from that tag: an unusable size must fall back, never crop blind.
    const camera = cameraReturning({ uri: 'file:///cache/probe.jpg', width: -1, height: -1 });
    manipulate.mockResolvedValue({
      uri: 'file:///cache/probe-tiny.png',
      width: PROBE_SIZE,
      height: PROBE_SIZE,
      base64: leafPng(),
    });

    await probeFrame(camera, { viewAspect: VIEW_ASPECT });

    expect(manipulate).toHaveBeenCalledWith(
      'file:///cache/probe.jpg',
      [{ resize: { width: PROBE_SIZE, height: PROBE_SIZE } }],
      { base64: true, format: 'png' },
    );
  });
});

describe('previewSquare', () => {
  it('keeps a centred square inside the visible part of a landscape frame', () => {
    // 3024 × 393/852 = 1395 px: the widest centred square the preview can show.
    expect(previewSquare({ width: 4032, height: 3024 }, VIEW_ASPECT)).toEqual({
      originX: 1319,
      originY: 815,
      width: 1395,
      height: 1395,
    });
  });

  it('gives the same square for the rotated frame, because a centred square is rotation-proof', () => {
    const landscape = previewSquare({ width: 4032, height: 3024 }, VIEW_ASPECT);
    const portrait = previewSquare({ width: 3024, height: 4032 }, VIEW_ASPECT);

    expect(portrait?.width).toBe(landscape?.width);
    expect(portrait?.height).toBe(landscape?.height);
  });

  it('takes the short side when the preview is square', () => {
    expect(previewSquare({ width: 400, height: 300 }, 1)).toEqual({
      originX: 50,
      originY: 0,
      width: 300,
      height: 300,
    });
  });

  it('refuses to guess when the size or the aspect is unusable', () => {
    expect(previewSquare({}, VIEW_ASPECT)).toBeNull();
    expect(previewSquare({ width: 0, height: 0 }, VIEW_ASPECT)).toBeNull();
    expect(previewSquare({ width: -1, height: -1 }, VIEW_ASPECT)).toBeNull();
    expect(previewSquare(SENSOR, 0)).toBeNull();
    expect(previewSquare(SENSOR, Number.NaN)).toBeNull();
  });
});

/**
 * The bug behind "I centred the plant and nothing happens", reproduced without a phone.
 *
 * A user frames a leaf to fill the on-screen guide, which is the shot the caption asks
 * for. The pre-fix probe measured 62% of the *whole capture*, a band about 1.8× wider
 * than the preview could show, so the leaf covered well under half of it and the score
 * sat below the bar no matter how carefully the plant was centred. Measuring the cropped
 * square — the part of the capture the preview actually displays — is what makes the
 * same frame reach it.
 */
describe('the probe measures the square the preview shows', () => {
  // A 280 pt guide in a 393 pt-wide preview of a 240 px-wide visible crop: ~79 px of
  // the 240×180 frame. The leaf fills the guide, and nothing beyond it.
  const GUIDE_PX = Math.round(Math.min(SENSOR.width, SENSOR.height) * VIEW_ASPECT * (280 / 393));
  const framed = framedLeaf(GUIDE_PX);

  it('would not fire on a plant framed in the guide, measured over the whole capture', () => {
    const sample = analyzeFrame(resizeTo(framed, PROBE_SIZE, PROBE_SIZE));

    expect(sample.coverage).toBeLessThan(0.5);
    expect(sample.score).toBeLessThan(AUTO_CAPTURE_READY_SCORE);
  });

  it('fires on that same frame, measured over the visible square', () => {
    const rect = previewSquare(SENSOR, VIEW_ASPECT);
    expect(rect).not.toBeNull();

    const sample = analyzeFrame(resizeTo(cropImage(framed, rect as CropRect), PROBE_SIZE, PROBE_SIZE));

    expect(sample.coverage).toBe(1);
    expect(sample.score).toBeGreaterThanOrEqual(AUTO_CAPTURE_READY_SCORE);
  });
});
