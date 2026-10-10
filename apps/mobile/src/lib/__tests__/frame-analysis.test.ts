/**
 * The auto-capture framing heuristic.
 *
 * Synthetic frames, because the properties that have to hold are geometric and
 * colour-based: a leaf only counts when it is in the centre, a flat green surface
 * must not reach the bar, and a non-plant colour must not count at all. The
 * thresholds themselves were calibrated on real photographs — see the table in
 * docs/testing.md and the comment on `AUTO_CAPTURE_READY_SCORE`.
 */

import * as UPNG from 'upng-js';

import {
  AUTO_CAPTURE_READY_SCORE,
  analyzeFrame,
  analyzePng,
  base64ToBytes,
  CENTRE_BOX,
  decodePng,
  type RgbaImage,
} from '@/lib/frame-analysis';

const SIZE = 64;

/** A leaf-green pair 84 luma apart: texture saturates `detail` rather than nudging it. */
const LEAF_DARK = [27, 94, 32] as const;
const LEAF_LIGHT = [124, 179, 66] as const;
const DESK = [141, 110, 99] as const;
const SKY = [21, 101, 192] as const;
const SKY_LIGHT = [66, 165, 245] as const;
const GREY = [128, 128, 128] as const;
const GREY_LIGHT = [200, 200, 200] as const;

/**
 * Paints a frame from a per-pixel function. `textured` alternates the two leaf
 * greens column by column, which is what a leaf close-up looks like once it is
 * 64×64: continuous colour, lots of adjacent-pixel contrast.
 */
const paint = (
  colour: (x: number, y: number) => readonly [number, number, number],
  size = SIZE,
): RgbaImage => {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = colour(x, y);
      const index = (y * size + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return { width: size, height: size, data };
};

const solid = (colour: readonly [number, number, number]) => () => colour;

const leafTexture = (x: number) => (x % 2 === 0 ? LEAF_DARK : LEAF_LIGHT);

/** Desk background with a vertical band of leaf texture covering `x0…x1`. */
const band = (x0: number, x1: number) =>
  paint((x) => (x >= x0 && x < x1 ? leafTexture(x) : DESK));

const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

describe('analyzeFrame', () => {
  it('scores a textured leaf close-up well above the ready bar', () => {
    const sample = analyzeFrame(paint(leafTexture));
    expect(sample.coverage).toBe(1);
    expect(sample.detail).toBeGreaterThan(0.9);
    expect(sample.score).toBeGreaterThanOrEqual(AUTO_CAPTURE_READY_SCORE);
  });

  it('does not fire on a flat green surface, which is why the bar is 0.75', () => {
    const flat = analyzeFrame(paint(solid(LEAF_LIGHT)));
    expect(flat.coverage).toBe(1);
    expect(flat.detail).toBe(0);
    // Coverage alone is worth 0.72: a green painted wall covers the frame but has
    // no veins, and only the texture term can tell the two apart.
    expect(flat.score).toBeCloseTo(0.72, 2);
    expect(flat.score).toBeLessThan(AUTO_CAPTURE_READY_SCORE);
  });

  it('only counts a leaf that is centred', () => {
    // A plant filling the left 40% of the frame is not the shot the caption asks
    // for: the centre box sees mostly desk.
    const left = analyzeFrame(band(0, 26));
    expect(left.coverage).toBeLessThan(0.5);
    expect(left.score).toBeLessThan(AUTO_CAPTURE_READY_SCORE);

    // The same band, moved into the middle, is.
    const centred = analyzeFrame(band(18, 46));
    expect(centred.coverage).toBeGreaterThan(0.6);
    expect(centred.score).toBeGreaterThanOrEqual(AUTO_CAPTURE_READY_SCORE);
  });

  it('ignores a textured frame that is not leaf-coloured', () => {
    const blue = analyzeFrame(paint((x) => (x % 2 === 0 ? SKY : SKY_LIGHT)));
    expect(blue.coverage).toBe(0);
    // Texture alone can only ever reach the texture share of the score.
    expect(blue.score).toBeLessThanOrEqual(0.28);

    const grey = analyzeFrame(paint((x) => (x % 2 === 0 ? GREY : GREY_LIGHT)));
    expect(grey.coverage).toBe(0);
    expect(grey.score).toBeLessThan(AUTO_CAPTURE_READY_SCORE);
  });

  it('still counts a yellowing leaf', () => {
    // Hue ~65°: low on the green scale but inside the window, so a variegated or
    // yellowing houseplant is not silently ignored.
    const yellowLeaf = analyzeFrame(paint((x) => (x % 2 === 0 ? [86, 130, 40] : [205, 220, 57])));
    expect(yellowLeaf.coverage).toBe(1);
    expect(yellowLeaf.score).toBeGreaterThanOrEqual(AUTO_CAPTURE_READY_SCORE);
  });

  it('reports the mean luminance of the centre box, which the steadiness check needs', () => {
    expect(analyzeFrame(paint(solid(GREY))).luma).toBeCloseTo(128, 0);
    expect(analyzeFrame(paint(solid([255, 255, 255]))).luma).toBeCloseTo(255, 0);
    expect(analyzeFrame(paint(solid([0, 0, 0]))).luma).toBeCloseTo(0, 0);
  });

  it('uses a centre box smaller than the frame', () => {
    expect(CENTRE_BOX).toBeGreaterThan(0.5);
    expect(CENTRE_BOX).toBeLessThan(1);
  });

  it('returns an empty sample instead of throwing on a frame too small to measure', () => {
    expect(analyzeFrame({ width: 1, height: 1, data: new Uint8Array(4) })).toEqual({
      coverage: 0,
      detail: 0,
      luma: 0,
      score: 0,
    });
    expect(analyzeFrame({ width: 4, height: 4, data: new Uint8Array(4) }).score).toBe(0);
  });
});

describe('base64ToBytes', () => {
  it('decodes the padding cases', () => {
    expect(Array.from(base64ToBytes(toBase64(new Uint8Array([]))))).toEqual([]);
    expect(Array.from(base64ToBytes('TQ=='))).toEqual([77]);
    expect(Array.from(base64ToBytes('TWE='))).toEqual([77, 97]);
    expect(Array.from(base64ToBytes('TWFu'))).toEqual([77, 97, 110]);
  });

  it('round-trips arbitrary bytes, including every high byte', () => {
    const bytes = new Uint8Array(256);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = index;
    expect(Array.from(base64ToBytes(toBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('tolerates the newlines and data-URL padding a capture may carry', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const wrapped = `data:image/png;base64,${toBase64(bytes).replace(/(.{4})/g, '$1\n')}`;
    expect(Array.from(base64ToBytes(wrapped))).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('decodePng', () => {
  it('decodes a real PNG back to the pixels that went in', () => {
    const original = paint(leafTexture);
    const encoded = UPNG.encode([original.data.buffer], original.width, original.height, 0);
    const decoded = decodePng(toBase64(new Uint8Array(encoded)));

    expect(decoded).not.toBeNull();
    expect(decoded?.width).toBe(original.width);
    expect(decoded?.height).toBe(original.height);
    // First and last pixel survive the round trip through upng's encoder.
    expect(Array.from(decoded?.data.slice(0, 4) ?? [])).toEqual([...LEAF_DARK, 255]);
    const last = (original.width * original.height - 1) * 4;
    expect(Array.from(decoded?.data.slice(last, last + 4) ?? [])).toEqual([...LEAF_LIGHT, 255]);
  });

  it('measures a decoded PNG exactly as it measures the raw frame', () => {
    const original = paint((x) => (x >= 18 && x < 46 ? leafTexture(x) : DESK));
    const encoded = UPNG.encode([original.data.buffer], original.width, original.height, 0);
    const sample = analyzePng(toBase64(new Uint8Array(encoded)));

    expect(sample).toEqual(analyzeFrame(original));
    expect(sample?.score).toBeGreaterThanOrEqual(AUTO_CAPTURE_READY_SCORE);
  });

  it('returns null rather than throwing on a payload that is not a PNG', () => {
    // A probe that cannot decode must leave the camera screen untouched.
    expect(decodePng('')).toBeNull();
    expect(decodePng('not base64 at all')).toBeNull();
    expect(decodePng(Buffer.from('definitely not a png').toString('base64'))).toBeNull();
    expect(analyzePng('not base64 at all')).toBeNull();
  });
});
