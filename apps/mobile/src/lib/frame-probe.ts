/**
 * One auto-capture probe: a cheap photo, cropped to the square the preview can
 * show, shrunk to a 64×64 PNG, measured, then deleted.
 *
 * `expo-camera` has no preview-frame callback, so the only way to look at what
 * the lens sees is `takePictureAsync`. Skipping the orientation pass makes that
 * fast enough to repeat while the screen is open, and it costs nothing in
 * accuracy here: the analysis measures a centred square, and rotation maps a
 * centred square to a centred square.
 *
 * **Why the crop is not optional.** On Android the preview is *not* the capture.
 * `CameraView` fills its container, which the native side implements as a centre
 * crop (`PreviewView.ScaleType.FILL_CENTER` — the default when no `ratio` prop is
 * passed, and screen 09 passes none), while `takePictureAsync` with
 * `skipProcessing` writes the raw sensor frame: whole, unrotated, uncropped. On an
 * iPhone-14-shaped screen (393×852) against a 4:3 sensor that is a wide mismatch —
 * the visible column is only ~46% of the frame's width, so a 62%-of-the-frame box
 * measured a band about 1.8× wider than anything the user could see. A plant
 * centred in the on-screen guide then covers barely a fifth of that box (measured
 * at 0.21 coverage, score 0.05), and the score never reaches the bar however
 * carefully the plant is centred.
 *
 * iOS is the milder case and shows why the geometry has to be reasoned about
 * rather than tuned per platform: `CameraPhotoCapture` crops the photo to the
 * preview's aspect ratio itself (`AVMakeRect`, `.resizeAspectFill` preview), so
 * there the capture already matches what the user saw and this crop only tightens
 * the window towards the centre of the guide. Both platforms run the same
 * arithmetic.
 *
 * `previewSquare` below cuts the capture down to a square that is inside the
 * visible region whichever way the sensor stored the frame, so the analysis
 * measures what the guide promised rather than what the sensor could reach.
 *
 * Both files are removed in a `finally`. A probe runs about once a second, and
 * every capture is a full-resolution JPEG however low the `quality` — leaving
 * them in the cache would grow by hundreds of megabytes across a long session.
 *
 * Why `expo-image-manipulator` and `expo-file-system` are loaded through the
 * functions below instead of statically, as in `lib/notifications.ts`: they are
 * native modules, and `requireNativeModule` throws while the package is being
 * *imported* when the running build does not contain them — which is exactly what
 * a development build made before auto-capture existed looks like. expo-router
 * eagerly imports every route file, so a static import here would take the whole
 * app down, not just this screen. Loaded lazily, a build without them gets the
 * manual flow and a probe that reports "no frame", because the loop treats a
 * failed probe as an empty frame.
 */

import type { Action } from 'expo-image-manipulator';

import { analyzePng, type FrameSample } from './frame-analysis';

/**
 * The slice of `expo-camera`'s `CameraView` a probe needs, so it can be faked in tests.
 *
 * `width`/`height` are the frame's stored pixel dimensions. `skipProcessing` reports
 * them straight from the file's EXIF tags, so they cost no decode, and they are what
 * makes the crop possible — without them the probe cannot relate the capture to the
 * preview and falls back to measuring the centre of the whole frame.
 */
export type ProbeCamera = {
  takePictureAsync: (options?: {
    quality?: number;
    skipProcessing?: boolean;
    exif?: boolean;
  }) => Promise<{ uri?: string; width?: number; height?: number } | undefined>;
};

export type PhotoSize = { width?: number; height?: number };
export type CropRect = { originX: number; originY: number; width: number; height: number };

/**
 * The largest centred square of the capture that fits inside what the preview shows.
 *
 * `viewAspect` is the preview's width/height in points. The preview shows a centre
 * crop of the frame with that aspect, so a centred square of side
 * `min(width, height) × min(viewAspect, 1/viewAspect)` always lands inside it — and
 * because a rotation swaps the frame's sides but leaves `min(width, height)` and a
 * centred square alone, this holds for any EXIF orientation. That matters: the probe
 * deliberately does not read the orientation tag.
 *
 * Returns `null` when the frame's dimensions are unknown (some cameras write no
 * `TAG_IMAGE_WIDTH`), which leaves the caller measuring the whole frame rather than
 * cropping blind.
 */
export const previewSquare = (photo: PhotoSize, viewAspect: number): CropRect | null => {
  const { width, height } = photo;
  if (!width || !height || width < 2 || height < 2) return null;
  if (!Number.isFinite(viewAspect) || viewAspect <= 0) return null;

  const shortSide = Math.min(width, height);
  const portrait = Math.min(viewAspect, 1 / viewAspect);
  const side = Math.max(2, Math.min(shortSide, Math.round(shortSide * portrait)));

  return {
    originX: Math.round((width - side) / 2),
    originY: Math.round((height - side) / 2),
    width: side,
    height: side,
  };
};

/** The square the analysis is measured on. Big enough for texture, small enough to decode per frame. */
export const PROBE_SIZE = 64;

type ManipulatorModule = typeof import('expo-image-manipulator');
type FileSystemModule = typeof import('expo-file-system');

let warnedAboutMissingModules = false;

const warnOnce = (): void => {
  if (warnedAboutMissingModules) return;
  warnedAboutMissingModules = true;
  console.warn(
    '[scan] auto-capture needs a build containing expo-image-manipulator and expo-file-system; ' +
      'falling back to the shutter. Rebuild the app to enable it.',
  );
};

/** Returns null when this build has no such native module. Never throws. */
const loadManipulator = (): ManipulatorModule | null => {
  try {
    // Metro's `require` is lazy, so this is the same guarantee and it stays a
    // require on purpose.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-manipulator') as ManipulatorModule;
  } catch {
    warnOnce();
    return null;
  }
};

const loadFileSystem = (): FileSystemModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system') as FileSystemModule;
  } catch {
    warnOnce();
    return null;
  }
};

const deleteQuietly = (uri?: string): void => {
  if (!uri) return;
  try {
    const fileSystem = loadFileSystem();
    if (fileSystem) new fileSystem.File(uri).delete();
  } catch {
    // A stray probe left in the cache is not worth failing a capture over.
  }
};

/**
 * Returns `null` instead of throwing when the camera, the build or the decoder
 * cannot deliver a frame: the caller loops, and a probe that fails must leave the
 * screen exactly as it was, with the shutter still working.
 *
 * `viewAspect` (the preview's aspect in points) is what ties the measurement to the
 * on-screen guide; see the note on `previewSquare`. Omitting it keeps the old
 * behaviour of measuring the centre of the whole capture.
 */
export const probeFrame = async (
  camera: ProbeCamera,
  options: { viewAspect?: number } = {},
): Promise<FrameSample | null> => {
  const manipulator = loadManipulator();
  if (!manipulator) return null;

  const shot = await camera.takePictureAsync({
    quality: 0.2,
    skipProcessing: true,
    exif: false,
  });
  if (!shot?.uri) return null;

  // Crop before resizing, so the resizer only ever touches the pixels that will be
  // measured: on a 12 MP frame the crop throws away most of the work.
  const crop = options.viewAspect === undefined ? null : previewSquare(shot, options.viewAspect);
  const actions: Action[] = crop
    ? [{ crop }, { resize: { width: PROBE_SIZE, height: PROBE_SIZE } }]
    : [{ resize: { width: PROBE_SIZE, height: PROBE_SIZE } }];

  let thumbnailUri: string | undefined;
  try {
    const thumbnail = await manipulator.manipulateAsync(shot.uri, actions, {
      base64: true,
      format: manipulator.SaveFormat.PNG,
    });
    thumbnailUri = thumbnail.uri;
    return thumbnail.base64 ? analyzePng(thumbnail.base64) : null;
  } finally {
    deleteQuietly(shot.uri);
    deleteQuietly(thumbnailUri);
  }
};
