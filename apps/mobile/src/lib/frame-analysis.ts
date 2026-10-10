/**
 * "Is a plant centred in this frame?" — the on-device half of auto-capture.
 *
 * Screen 09 can fire the shutter by itself (docs/changelog.md), which means
 * answering that question on the phone: a probe costs about a second of camera
 * time and PlantNet's quota is finite, so polling the server for every frame is
 * not an option. The species still comes from the vendor — this only decides the
 * moment the photo is taken.
 *
 * It is a *framing* heuristic, not a classifier. Three signals, all measured on
 * the centre box only, which is what "centred" means here:
 *
 *   - `coverage` — how much of the centre box is leaf-coloured (hue, not just
 *     "green channel is highest", so yellow-leafed and dark houseplants count).
 *   - `detail` — the luma gradient across that coverage. A painted green wall
 *     covers the frame but is flat; a leaf has veins and edges.
 *   - `luma` — mean brightness, compared between frames to tell a held phone
 *     from a moving one.
 *
 * The pure functions are separated from the camera so they can be tested: the
 * synthetic cases are in `frame-analysis.test.ts`, and the thresholds come from
 * the real-photograph calibration recorded in docs/testing.md.
 */

import * as UPNG from 'upng-js';

export type RgbaImage = {
  width: number;
  height: number;
  /** Row-major RGBA, 4 bytes per pixel. */
  data: Uint8Array;
};

export type FrameSample = {
  /** Fraction of the centre box that is leaf-coloured. */
  coverage: number;
  /** 0–1 texture inside that coverage. */
  detail: number;
  /** Mean luminance of the centre box, 0–255. */
  luma: number;
  /** 0–1: how much this frame looks like a centred plant. */
  score: number;
};

/**
 * The centre box, as a fraction of the smaller frame side. Deliberately smaller
 * than the on-screen frame so a leaf held against the corners of the guide still
 * leaves the centre looking like background — the guide means what it says.
 */
export const CENTRE_BOX = 0.62;

/** Hue window treated as foliage, in degrees. Leaves run from yellow-green to teal-green. */
const LEAF_HUE_MIN = 55;
const LEAF_HUE_MAX = 170;
const LEAF_MIN_SATURATION = 0.16;

/** Coverage below this is background; at or above the ceiling the frame is all leaf. */
const COVERAGE_FLOOR = 0.18;
const COVERAGE_CEILING = 0.62;

/** Mean absolute luma gradient, per pixel, at which a surface counts as textured. */
const DETAIL_FLOOR = 4;
const DETAIL_CEILING = 22;

/**
 * The score at which a frame is worth firing on.
 *
 * Measured against real photographs, downscaled to a probe frame (the table is in
 * docs/testing.md): foliage close-ups — the shot Pl@ntNet scores highest, and the
 * one the caption asks for — land at 0.89 (Ficus lyrata), 0.90 (Spathiphyllum),
 * 0.96 (fern) and 1.00 (Monstera, on 0.84 frame coverage). Everything that is not
 * plant matter is far below: dogs 0.00, a laptop 0.00, a phone on a desk 0.28, a
 * city skyline 0.00, a cat 0.17. Plants photographed small inside a scene score
 * 0.11–0.50, which is deliberate — the caption asks for the plant to fill the
 * frame, and a whole plant on a floor is exactly the photo the vendor answers
 * weakly (32% for such an ivy shot, against 85% for a leaf close-up).
 *
 * 0.75 rather than 0.62 so an *untextured* green surface cannot fire on coverage
 * alone: a flat leaf-green frame scores 0.72, because coverage is worth 0.72 of
 * the score and texture the other 0.28. Fully textured greenery — a waterfall over
 * moss — scores 0.82 and does fire; the vendor then decides whether that is a
 * plant, and its answer reaches screen 12 rather than an error.
 */
export const AUTO_CAPTURE_READY_SCORE = 0.75;

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

const ramp = (value: number, floor: number, ceiling: number): number =>
  clamp01((value - floor) / (ceiling - floor));

/** Hue/saturation test rather than a channel ratio: a green channel that merely leads fails. */
const isFoliage = (r: number, g: number, b: number): boolean => {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (max < 32 || delta === 0) return false;
  if (delta / max < LEAF_MIN_SATURATION) return false;

  let hue: number;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;

  return hue >= LEAF_HUE_MIN && hue <= LEAF_HUE_MAX;
};

const lumaOf = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Measures one frame. Everything is computed from the centre box; the border is
 * ignored, which is what makes this "centred" and not "a plant is somewhere".
 */
export const analyzeFrame = (image: RgbaImage): FrameSample => {
  const { width, height, data } = image;
  const boxWidth = Math.round(width * CENTRE_BOX);
  const boxHeight = Math.round(height * CENTRE_BOX);
  if (boxWidth < 2 || boxHeight < 2 || data.length < width * height * 4) {
    return { coverage: 0, detail: 0, luma: 0, score: 0 };
  }

  const startX = Math.floor((width - boxWidth) / 2);
  const startY = Math.floor((height - boxHeight) / 2);

  let foliage = 0;
  let pixels = 0;
  let lumaSum = 0;
  let gradientSum = 0;
  let gradientCount = 0;

  for (let y = startY; y < startY + boxHeight; y += 1) {
    // Reset at each row: a gradient is only measured between neighbouring
    // covered pixels, never across a gap or the wrap to the next row.
    let previousLuma: number | null = null;
    for (let x = startX; x < startX + boxWidth; x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const luma = lumaOf(r, g, b);

      lumaSum += luma;
      pixels += 1;

      if (isFoliage(r, g, b)) {
        foliage += 1;
        if (previousLuma !== null) {
          gradientSum += Math.abs(luma - previousLuma);
          gradientCount += 1;
        }
        previousLuma = luma;
      } else {
        previousLuma = null;
      }
    }
  }

  const coverage = pixels > 0 ? foliage / pixels : 0;
  const luma = pixels > 0 ? lumaSum / pixels : 0;
  const gradient = gradientCount > 0 ? gradientSum / gradientCount : 0;
  const detail = ramp(gradient, DETAIL_FLOOR, DETAIL_CEILING);

  // Coverage dominates: a frame full of leaf is almost always the shot we want,
  // while texture only has to rule out the flat green surface.
  const score = clamp01(0.72 * ramp(coverage, COVERAGE_FLOOR, COVERAGE_CEILING) + 0.28 * detail);

  return { coverage, detail, luma, score };
};

/**
 * Base64 → bytes without `atob` or `Buffer`: Hermes ships neither on every
 * platform, and this is the one place the app decodes a binary payload.
 *
 * A `data:` prefix is stripped rather than filtered: every character in
 * `data:image/png;base64` is itself valid base64, so leaving it in place would
 * decode the prefix as pixels instead of dropping it.
 */
export const base64ToBytes = (base64: string): Uint8Array => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Map<string, number>();
  for (let index = 0; index < alphabet.length; index += 1) {
    lookup.set(alphabet[index] as string, index);
  }

  const clean = base64.replace(/^data:[^,]*;base64,/, '').replace(/\s+/g, '');
  const length = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(length);

  let accumulator = 0;
  let bits = 0;
  let offset = 0;
  for (const character of clean) {
    const value = lookup.get(character);
    if (value === undefined) continue;
    accumulator = (accumulator << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[offset] = (accumulator >> bits) & 0xff;
      offset += 1;
    }
  }

  return offset === bytes.length ? bytes : bytes.slice(0, offset);
};

/**
 * Decodes the small PNG `expo-image-manipulator` hands back into RGBA.
 *
 * Returns `null` rather than throwing: a probe that fails must leave the camera
 * screen exactly as it was, with the shutter still working.
 */
export const decodePng = (base64: string): RgbaImage | null => {
  try {
    const bytes = base64ToBytes(base64);
    const decoded = UPNG.decode(bytes.buffer);
    const [rgba] = UPNG.toRGBA8(decoded);
    if (!rgba || !decoded.width || !decoded.height) return null;
    return { width: decoded.width, height: decoded.height, data: new Uint8Array(rgba) };
  } catch {
    return null;
  }
};

/** Convenience for callers that only have the base64 from a capture. */
export const analyzePng = (base64: string): FrameSample | null => {
  const image = decodePng(base64);
  return image ? analyzeFrame(image) : null;
};
