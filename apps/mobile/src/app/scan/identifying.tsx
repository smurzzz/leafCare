/**
 * 10 — Identifying. Blurred photo backdrop, bottom sheet with a spinner, an
 * indeterminate progress bar, a live "Found N possible matches so far" counter
 * and a Cancel that aborts the request and discards the identification.
 */

import { palette, radius, spacing } from '@leafcare/shared';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useAnimatedValue, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, TextButton } from '@/components/ui/primitives';
import { ApiError, api } from '@/lib/api';
import { clearScanSession, getScanSession, setScanResult } from '@/lib/scan-session';

/** docs/troubleshooting.md: timeout ~20s, then the error screen. */
const TIMEOUT_MS = 20_000;

export default function IdentifyingRoute() {
  const router = useRouter();
  const session = getScanSession();

  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const requestIdRef = useRef<string>(Crypto.randomUUID());

  const [matches, setMatches] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const progress = useAnimatedValue(0);

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    await api.cancelIdentify(requestIdRef.current).catch(() => undefined);
    clearScanSession();
    router.replace('/scan');
  }, [router]);

  // Motion: indeterminate bar plus the 1→3 match count-up (docs/ui-ux.md).
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 0.95,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(progress, { toValue: 0.15, duration: 700, useNativeDriver: false }),
      ]),
    );
    loop.start();

    const matchTimer = setInterval(() => setMatches((value) => (value >= 3 ? 1 : value + 1)), 1400);
    const tick = setInterval(() => setElapsed((value) => value + 1), 1000);

    return () => {
      loop.stop();
      clearInterval(matchTimer);
      clearInterval(tick);
    };
  }, [progress]);

  useEffect(() => {
    if (!session) {
      router.replace('/scan');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const run = async () => {
      try {
        const result = await api.identify(
          { uri: session.photoUri, mimeType: 'image/jpeg', fileName: 'leaf.jpg' },
          { signal: controller.signal, requestId: requestIdRef.current },
        );
        if (cancelledRef.current) return;
        setScanResult(requestIdRef.current, result);
        router.replace(result.threshold === 'high' ? '/scan/result' : '/scan/uncertain');
      } catch (error) {
        if (cancelledRef.current) return;
        const offline = error instanceof ApiError && error.isOffline;
        const message =
          error instanceof ApiError
            ? error.message
            : 'This took too long. Even daylight and a single leaf in the frame help.';
        router.replace({
          pathname: '/error',
          params: { message, retry: offline ? 'none' : 'identify' },
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    void run();

    return () => {
      clearTimeout(timeout);
      controller.abort();
      abortRef.current = null;
    };
  }, [router, session]);

  const animatedWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['8%', '95%'],
  });

  return (
    <View style={styles.screen}>
      {session ? (
        <Image
          source={{ uri: session.photoUri }}
          style={StyleSheet.absoluteFill}
          blurRadius={16}
          contentFit="cover"
        />
      ) : null}
      <View style={styles.scrim} />

      <SafeAreaView style={styles.sheetWrap} edges={['bottom']}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.spinnerRow}>
            <View style={styles.spinnerDot} />
            <Text style={styles.title}>Identifying your plant...</Text>
          </View>
          <Text style={styles.body}>Matching leaf shape, texture and vein pattern</Text>

          <View style={styles.thumbRow}>
            {session ? (
              <Image source={{ uri: session.photoUri }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: palette.mint }]} />
            )}
            <View style={{ flex: 1, gap: spacing.sm }}>
              <View style={styles.barTrack}>
                <Animated.View style={[styles.barFill, { width: animatedWidth }]} />
              </View>
              <Text style={styles.progressHint}>
                Found {matches} possible match{matches === 1 ? '' : 'es'} so far
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{elapsed}s</Text>
            <Text style={styles.metaText}>Usually under 15 seconds</Text>
          </View>

          <Button label="Cancel" variant="secondary" onPress={() => void cancel()} />
          <View style={{ alignItems: 'center' }}>
            <TextButton
              label="This photo isn’t a plant"
              tone="muted"
              onPress={() => void cancel()}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E1411', justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,20,14,0.35)' },
  sheetWrap: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.xxl,
    gap: spacing.md,
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.ring,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  spinnerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  spinnerDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: palette.forest },
  title: { fontSize: 20, fontWeight: '800', color: palette.ink, letterSpacing: -0.4 },
  body: { fontSize: 13, color: palette.muted, lineHeight: 19 },
  thumbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  thumb: { width: 56, height: 56, borderRadius: 14 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: palette.ring, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: palette.forest },
  progressHint: { fontSize: 12, color: palette.muted, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  metaText: { fontSize: 11, color: palette.muted },
});
