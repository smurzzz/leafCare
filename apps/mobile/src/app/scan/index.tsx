/**
 * 09 — Scan camera. Live preview with the rounded leaf frame, shutter, gallery,
 * flash and flip; falls back to 24 — Camera permission when not granted.
 *
 * **Auto-capture** is on by default: the frame is watched about once a second and
 * the shutter fires by itself once a plant has been centred and held still for a
 * moment, so pointing the phone at a leaf is enough. It is a framing heuristic on
 * the device (`frame-analysis.ts`), never a species guess — the identification
 * still comes from the vendor via `/api/identify`. The toggle in the top row puts
 * the screen back to exactly what the PNG shows, where the shutter is the only
 * way to take a photo, and the caption is unchanged in both modes until a plant
 * is actually in the frame.
 *
 * The window size is handed to the loop because the preview is a centre crop of
 * the capture: without it the probe measures a band wider than the guide frame and
 * auto-capture can never fire, however carefully the plant is centred. The reason
 * is written up in `lib/frame-probe.ts`.
 */

import { palette, spacing } from '@leafcare/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CloseIcon, FlipIcon, FlashIcon, LeafIcon } from '@/components/icons';
import { CameraPermissionState, openAppSettings } from '@/screens/camera-permission';
import { IconButton } from '@/components/ui/primitives';
import { useAutoCapture, type AutoCaptureStatus } from '@/hooks/use-auto-capture';
import { startScanSession } from '@/lib/scan-session';

/** Screen 11 wants the real photo, not the probe frame. */
const CAPTURE_QUALITY = 0.85;

const CAPTIONS: Record<AutoCaptureStatus, string> = {
  // The PNG's own copy, and still the copy when auto-capture is off.
  off: 'Center the leaf in the frame',
  searching: 'Center the plant in the frame',
  holding: 'Hold still',
  ready: 'Hold still…',
  capturing: 'Identifying…',
  // Not a framing problem, so the framing instruction would be a lie: the probe has
  // measured nothing at all for several seconds (see lib/frame-probe.ts).
  blind: 'Auto can’t see the frame here — tap the shutter',
  gaveUp: 'Tap the shutter when the plant fills the frame',
};

export default function ScanCameraRoute() {
  const router = useRouter();
  // The preview fills the window, so its aspect is the window's. The probe needs it
  // to work out which part of the capture the user is actually looking at.
  const { width: viewWidth, height: viewHeight } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);

  // The scan screen stays mounted underneath the identifying screen, so probing
  // has to stop on blur or the camera would keep firing behind the result.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  const begin = (uri: string) => {
    setLastPhoto(uri);
    startScanSession(uri);
    router.push('/scan/identifying');
  };

  const capture = async (quality: number) => {
    const camera = cameraRef.current;
    if (!camera || capturing) return;
    setCapturing(true);
    try {
      const photo = await camera.takePictureAsync({ quality, skipProcessing: false });
      if (photo?.uri) begin(photo.uri);
    } catch (error) {
      console.warn('[scan] capture failed', error);
    } finally {
      setCapturing(false);
    }
  };

  const autoState = useAutoCapture({
    cameraRef,
    enabled: autoCapture && focused && permission?.granted === true,
    onCapture: () => capture(CAPTURE_QUALITY),
    viewAspect: viewWidth / viewHeight,
  });

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      exif: false,
    });
    if (!result.canceled && result.assets[0]?.uri) begin(result.assets[0].uri);
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.caption}>Preparing camera…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <CameraPermissionState
        canAskAgain={permission.canAskAgain}
        busy={capturing}
        onAllow={() => void requestPermission().then(() => undefined)}
        onNotNow={close}
        onOpenSettings={openAppSettings}
      />
    );
  }

  const locked = autoState.status === 'ready' || autoState.status === 'capturing';
  // The ring tracks a plant approaching the bar, so it is meaningless while the
  // probe cannot see anything at all.
  const watching =
    autoCapture &&
    (autoState.status === 'searching' || autoState.status === 'holding' || locked);

  return (
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={torch ? 'on' : 'off'}
      />

      <View style={styles.dim} pointerEvents="none">
        <View style={[styles.frame, locked && styles.frameLocked]}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>
      </View>

      <SafeAreaView style={styles.chrome} edges={['top']}>
        <View style={styles.topRow}>
          <IconButton accessibilityLabel="Close camera" onPress={close} variant="glass">
            <CloseIcon size={18} color="#FFFFFF" />
          </IconButton>

          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Capture automatically when a plant is centered"
            accessibilityState={{ checked: autoCapture }}
            onPress={() => setAutoCapture((value) => !value)}
            style={[styles.autoToggle, autoCapture && styles.autoToggleOn]}
          >
            <LeafIcon size={16} color={autoCapture ? palette.forest : '#FFFFFF'} />
            <Text style={[styles.autoLabel, autoCapture && styles.autoLabelOn]}>Auto</Text>
          </Pressable>

          <IconButton
            accessibilityLabel="Flip camera"
            onPress={() => setFacing((value) => (value === 'back' ? 'front' : 'back'))}
            variant="glass"
          >
            <FlipIcon size={18} color="#FFFFFF" />
          </IconButton>
        </View>

        <View style={styles.captionWrap} pointerEvents="none">
          <Text style={styles.caption}>{CAPTIONS[autoState.status]}</Text>
          {watching ? (
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.round(autoState.progress * 100)}%` }]}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.bottomRow}>
          <IconButton accessibilityLabel="Choose from gallery" onPress={() => void pickFromGallery()} variant="glass">
            {lastPhoto ? (
              <Image source={{ uri: lastPhoto }} style={styles.thumb} contentFit="cover" />
            ) : (
              <Text style={{ fontSize: 16 }}>🖼️</Text>
            )}
          </IconButton>

          <IconButton
            accessibilityLabel="Take photo"
            onPress={() => void capture(CAPTURE_QUALITY)}
            size={76}
            variant="glass"
            style={styles.shutter}
          >
            <View style={[styles.shutterInner, capturing && { opacity: 0.6 }]} />
          </IconButton>

          <IconButton
            accessibilityLabel={torch ? 'Turn flash off' : 'Turn flash on'}
            onPress={() => setTorch((value) => !value)}
            variant="glass"
            style={torch ? { backgroundColor: palette.mint } : undefined}
          >
            <FlashIcon size={18} color={torch ? palette.forest : '#FFFFFF'} />
          </IconButton>
        </View>
      </SafeAreaView>
    </View>
  );
}

const FRAME = 280;
const CORNER = 34;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  dim: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  // Turning solid mint is the "about to fire" signal, so the capture is never a
  // surprise: the frame says it before the shutter does.
  frameLocked: { borderWidth: 3, borderColor: palette.mintIcon },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: palette.mintIcon },
  cornerTopLeft: { top: -2, left: -2, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 22 },
  cornerTopRight: { top: -2, right: -2, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 22 },
  cornerBottomLeft: { bottom: -2, left: -2, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 22 },
  cornerBottomRight: { bottom: -2, right: -2, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 22 },
  chrome: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm },
  autoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  autoToggleOn: { backgroundColor: palette.mint, borderColor: palette.mintIcon },
  autoLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  autoLabelOn: { color: palette.forest },
  captionWrap: { alignItems: 'center', gap: spacing.sm },
  caption: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressTrack: {
    width: 132,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: palette.mintIcon },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  thumb: { width: 30, height: 30, borderRadius: 8 },
  shutter: { borderWidth: 4, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'transparent' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },
});
