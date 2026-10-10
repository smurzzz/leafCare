/**
 * 01 — Splash.
 *
 * Tap anywhere, or wait ~2s, then route: onboarding → auth → tabs.
 */

import { useAuth } from '@clerk/expo';
import { palette, spacing } from '@leafcare/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { LeafDecor, SplashMark } from '@/components/illustrations';
import { hasOnboarded, setHasOnboarded } from '@/lib/storage';

const SPLASH_MS = 2000;

export default function SplashScreenRoute() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const fade = useRef(new Animated.Value(0)).current;
  const navigated = useRef(false);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  const go = useCallback(async () => {
    if (navigated.current) return;
    navigated.current = true;
    const onboarded = await hasOnboarded();
    if (!onboarded) {
      router.replace('/onboarding');
      return;
    }
    router.replace(isSignedIn ? '/(tabs)/home' : '/(auth)/sign-in');
  }, [isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      void go();
    }, SPLASH_MS);
    return () => clearTimeout(timer);
  }, [isLoaded, go]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Start LeafCare" onPress={() => void go()} style={styles.screen}>
      <View style={styles.decorTop}>
        <LeafDecor size={220} color="rgba(255,255,255,0.10)" rotate={12} />
      </View>
      <View style={styles.decorBottom}>
        <LeafDecor size={260} color="rgba(255,255,255,0.10)" rotate={-150} />
      </View>

      <Animated.View style={[styles.center, { opacity: fade }]}>
        <SplashMark size={150} />
        <Text style={styles.title}>LeafCare</Text>
        <Text style={styles.subtitle}>Know your plant. Keep it alive.</Text>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <Text style={styles.hint}>Tap anywhere to continue</Text>
      </View>
    </Pressable>
  );
}

/** Used by the auth screens' "start over" affordance. */
export const resetOnboardingFlag = () => setHasOnboarded(false);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.forestDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorTop: { position: 'absolute', top: -60, left: -70 },
  decorBottom: { position: 'absolute', bottom: -80, right: -80 },
  center: { alignItems: 'center', gap: spacing.md },
  title: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.2,
    marginTop: spacing.lg,
  },
  subtitle: { color: palette.mint, fontSize: 15, fontWeight: '500', maxWidth: 260, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 48, alignItems: 'center', gap: spacing.lg },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 24, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.85)' },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' },
});
