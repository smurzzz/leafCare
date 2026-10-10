/**
 * 09 — Scan camera. Live preview with the rounded leaf frame, shutter, gallery,
 * flash and flip; falls back to 24 — Camera permission when not granted.
 */

import { palette, spacing } from '@leafcare/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CloseIcon, FlipIcon, FlashIcon } from '@/components/icons';
import { CameraPermissionState, openAppSettings } from '@/screens/camera-permission';
import { IconButton } from '@/components/ui/primitives';
import { startScanSession } from '@/lib/scan-session';

export default function ScanCameraRoute() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  const begin = (uri: string) => {
    setLastPhoto(uri);
    startScanSession(uri);
    router.push('/scan/identifying');
  };

  const takePicture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (photo?.uri) begin(photo.uri);
    } catch (error) {
      console.warn('[scan] capture failed', error);
    } finally {
      setCapturing(false);
    }
  };

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

  return (
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={torch ? 'on' : 'off'}
      />

      <View style={styles.dim} pointerEvents="none">
        <View style={styles.frame}>
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
          <IconButton
            accessibilityLabel="Flip camera"
            onPress={() => setFacing((value) => (value === 'back' ? 'front' : 'back'))}
            variant="glass"
          >
            <FlipIcon size={18} color="#FFFFFF" />
          </IconButton>
        </View>

        <View style={styles.captionWrap} pointerEvents="none">
          <Text style={styles.caption}>Center the leaf in the frame</Text>
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
            onPress={() => void takePicture()}
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
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: palette.mintIcon },
  cornerTopLeft: { top: -2, left: -2, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 22 },
  cornerTopRight: { top: -2, right: -2, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 22 },
  cornerBottomLeft: { bottom: -2, left: -2, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 22 },
  cornerBottomRight: { bottom: -2, right: -2, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 22 },
  chrome: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm },
  captionWrap: { alignItems: 'center' },
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
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  thumb: { width: 30, height: 30, borderRadius: 8 },
  shutter: { borderWidth: 4, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'transparent' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },
});
