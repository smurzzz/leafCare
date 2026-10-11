#!/usr/bin/env node
/**
 * Regenerates every LeafCare app icon from the brand mark.
 *
 *   node scripts/make-icons.mjs
 *
 * The mark in `apps/mobile/assets/brand/leafcare-mark.png` — a transparent PNG of the
 * two leaves and the water-drop — is the single source of truth. Everything in
 * `apps/mobile/assets/images` is derived from it, so replacing the master and re-running
 * this script refreshes the whole set instead of hand-editing five binaries.
 *
 * Padding is geometric, not aesthetic guesswork, and it follows how each platform masks:
 *
 * - `icon.png` (iOS/macOS, 1024) is drawn edge to edge and then masked with a squircle, so
 *   the mark is fitted to a bounding box of 72% — enough air that nothing sits near the cut.
 * - `android-icon-foreground.png` is composited inside the adaptive-icon safe zone: the
 *   launcher may show only the middle 61% circle of the canvas, so the mark's furthest
 *   opaque pixel is held at 32% of the canvas from the centre.
 * - `android-icon-monochrome.png` is the same geometry as a flat silhouette (Android 13
 *   themed icons tint the alpha channel, so colour is irrelevant).
 * - `splash-icon.png` keeps its own transparent margin: Android 12+ clips the launch image
 *   to a circle, and the older code path shows it at `imageWidth`.
 * - `favicon.png` is the smallest surface, so the mark is pushed out to 84%.
 *
 * The opaque icons are written without an alpha channel: Apple rejects app icons that carry
 * one. The adaptive background is app.json's `android.adaptiveIcon.backgroundColor`, so no
 * background image is generated.
 *
 * `sharp` is pulled in from the Next.js dependency tree. If it is missing:
 *
 *   npm i -D sharp
 */

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = join(ROOT, 'apps/mobile/assets/brand/leafcare-mark.png');
const OUT_DIR = join(ROOT, 'apps/mobile/assets/images');

/** Brand tokens — mirrors `palette` in packages/shared/src/tokens.ts. */
const FOREST_DEEP = '#163D2E';

/** Anything fainter than this is empty canvas left over from the export. */
const ALPHA_FLOOR = 8;

/**
 * @typedef {object} Spec
 * @property {string} file                  output file name
 * @property {number} size                  canvas edge, square
 * @property {string|null} background       null keeps transparency
 * @property {'bbox'|'radius'} by           what the padding rule measures
 * @property {number} fraction              share of the canvas that measurement may take
 * @property {boolean} [silhouette]         flatten to a single-colour alpha mask
 * @property {boolean} [opaque]             drop the alpha channel (Apple requires this)
 */

/** @type {Spec[]} */
const SPECS = [
  { file: 'icon.png', size: 1024, background: FOREST_DEEP, by: 'bbox', fraction: 0.72, opaque: true },
  { file: 'android-icon-foreground.png', size: 1024, background: null, by: 'radius', fraction: 0.32 },
  { file: 'android-icon-monochrome.png', size: 432, background: null, by: 'radius', fraction: 0.32, silhouette: true },
  { file: 'splash-icon.png', size: 512, background: null, by: 'bbox', fraction: 0.56 },
  { file: 'favicon.png', size: 48, background: FOREST_DEEP, by: 'bbox', fraction: 0.84, opaque: true },
];

/** Bounding box and furthest-pixel radius of the mark, ignoring near-transparent pixels. */
const measure = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cx = info.width / 2;
  const cy = info.height / 2;
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  let radius = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] <= ALPHA_FLOOR) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (r > radius) radius = r;
    }
  }

  if (right < 0) throw new Error(`${MASTER} is fully transparent`);
  return { left, top, width: right - left + 1, height: bottom - top + 1, radius, info };
};

/** Crop the mark to its own bounds so padding is added by this script, not inherited. */
const cropToMark = async (buffer, box) =>
  sharp(buffer)
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .png()
    .toBuffer();

/** The scale that satisfies a spec's padding rule for a given mark. */
const scaleFor = (spec, mark) => (spec.size * spec.fraction) / (spec.by === 'bbox' ? Math.max(mark.width, mark.height) : mark.radius);

/** Centre the scaled mark on a square canvas, optionally over a solid colour. */
const compose = async (markBuffer, spec, scale) => {
  const meta = await sharp(markBuffer).metadata();
  const width = Math.max(1, Math.round(meta.width * scale));
  const height = Math.max(1, Math.round(meta.height * scale));
  const scaled = await sharp(markBuffer).resize({ width, height, fit: 'fill' }).png().toBuffer();
  const canvas = sharp({
    create: {
      width: spec.size,
      height: spec.size,
      channels: 4,
      background: spec.background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  return canvas
    .composite([{ input: scaled, left: Math.round((spec.size - width) / 2), top: Math.round((spec.size - height) / 2) }])
    .png()
    .toBuffer();
};

/** Android tints the alpha channel of a themed icon, so the colour only has to be uniform. */
const toSilhouette = async (buffer) => {
  const { info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const white = await sharp({ create: { width: info.width, height: info.height, channels: 4, background: '#FFFFFF' } })
    .png()
    .toBuffer();
  // `dest-in` keeps the white fill only where the mark is opaque, alpha included.
  return sharp(white).composite([{ input: buffer, blend: 'dest-in' }]).png().toBuffer();
};

const main = async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  const master = readFileSync(MASTER);
  const mark = await measure(master);
  const cropped = await cropToMark(master, mark);
  const croppedMark = await measure(cropped);

  console.log(
    `master ${croppedMark.width}x${croppedMark.height} · furthest pixel at ${(croppedMark.radius / croppedMark.width).toFixed(3)} of the width`,
  );

  for (const spec of SPECS) {
    const scale = scaleFor(spec, croppedMark);
    const placed = await compose(cropped, spec, scale);
    const withSilhouette = spec.silhouette ? await toSilhouette(placed) : placed;
    const final = spec.opaque
      ? await sharp(withSilhouette).flatten({ background: spec.background ?? '#FFFFFF' }).removeAlpha().png({ compressionLevel: 9 }).toBuffer()
      : await sharp(withSilhouette).png({ compressionLevel: 9 }).toBuffer();

    const target = join(OUT_DIR, spec.file);
    writeFileSync(target, final);
    const meta = await sharp(target).metadata();
    console.log(
      `  ${spec.file.padEnd(30)} ${meta.width}x${meta.height} ${meta.channels}ch ${(statSync(target).size / 1024).toFixed(0)}kB  scale ${scale.toFixed(3)}`,
    );
  }
};

await main();
