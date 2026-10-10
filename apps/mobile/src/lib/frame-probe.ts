/**
 * One auto-capture probe: a cheap photo, shrunk to a 64×64 PNG, measured, then
 * deleted.
 *
 * `expo-camera` has no preview-frame callback, so the only way to look at what
 * the lens sees is `takePictureAsync`. Skipping the orientation pass makes that
 * fast enough to repeat while the screen is open, and it costs nothing in
 * accuracy here: the analysis measures the centre box, which rotation does not
 * move.
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

import { analyzePng, type FrameSample } from './frame-analysis';

/** The slice of `expo-camera`'s `CameraView` a probe needs, so it can be faked in tests. */
export type ProbeCamera = {
  takePictureAsync: (options?: {
    quality?: number;
    skipProcessing?: boolean;
    exif?: boolean;
  }) => Promise<{ uri?: string } | undefined>;
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
 */
export const probeFrame = async (camera: ProbeCamera): Promise<FrameSample | null> => {
  const manipulator = loadManipulator();
  if (!manipulator) return null;

  const shot = await camera.takePictureAsync({
    quality: 0.2,
    skipProcessing: true,
    exif: false,
  });
  if (!shot?.uri) return null;

  let thumbnailUri: string | undefined;
  try {
    const thumbnail = await manipulator.manipulateAsync(
      shot.uri,
      [{ resize: { width: PROBE_SIZE, height: PROBE_SIZE } }],
      { base64: true, format: manipulator.SaveFormat.PNG },
    );
    thumbnailUri = thumbnail.uri;
    return thumbnail.base64 ? analyzePng(thumbnail.base64) : null;
  } finally {
    deleteQuietly(shot.uri);
    deleteQuietly(thumbnailUri);
  }
};
