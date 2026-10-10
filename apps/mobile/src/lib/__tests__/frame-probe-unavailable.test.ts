/**
 * Auto-capture in a build that has no `expo-image-manipulator`.
 *
 * This is not hypothetical: auto-capture added two native modules, so a
 * development build made before it — or any APK built from an older commit —
 * loads this JS without them. `requireNativeModule` throws while a package is
 * being *imported*, and expo-router imports every route file eagerly, so a static
 * import would have taken the whole app down instead of just this feature.
 *
 * A separate file because the failure has to happen at module load: a mock factory
 * that throws is only meaningful on its own.
 */

import { probeFrame, type ProbeCamera } from '@/lib/frame-probe';

jest.mock('expo-image-manipulator', () => {
  throw new Error("Cannot find native module 'ExpoImageManipulator'");
});

jest.mock('expo-file-system', () => {
  throw new Error("Cannot find native module 'ExpoFileSystem'");
});

describe('probeFrame without the native modules', () => {
  it('reports no frame instead of throwing, so the shutter still works', async () => {
    const camera: ProbeCamera = { takePictureAsync: jest.fn() };

    await expect(probeFrame(camera)).resolves.toBeNull();
    // It never even asks the camera for a photo it could not measure.
    expect(camera.takePictureAsync).not.toHaveBeenCalled();
  });
});
