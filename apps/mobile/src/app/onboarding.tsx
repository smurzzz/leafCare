/**
 * 02–04 — Onboarding slides. Copy is locked to the screenshots; Skip and Get
 * Started both persist `hasOnboarded=true`.
 */

import { palette, spacing } from '@leafcare/shared';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingArtGrow, OnboardingArtIdentify, OnboardingArtReminder } from '@/components/illustrations';
import { Button, TextButton } from '@/components/ui/primitives';
import { setHasOnboarded } from '@/lib/storage';

const SLIDES = [
  {
    key: 'identify',
    title: 'Identify any plant in seconds',
    body: 'Point your camera at a leaf and get the exact species, plus a care plan built around it.',
    Art: OnboardingArtIdentify,
  },
  {
    key: 'remind',
    title: 'Never forget to water again',
    body: 'We build a watering schedule around your plant and your routine, then nudge you right on time.',
    Art: OnboardingArtReminder,
  },
  {
    key: 'grow',
    title: 'Watch your plant family grow',
    body: 'Log every watering, build streaks, and see how your plants thrive across the seasons.',
    Art: OnboardingArtGrow,
  },
] as const;

const { width } = Dimensions.get('window');

export default function OnboardingRoute() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const finish = async (destination: 'sign-up' | 'sign-in') => {
    await setHasOnboarded(true);
    router.replace(destination === 'sign-up' ? '/(auth)/sign-up' : '/(auth)/sign-in');
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const advance = () => {
    if (index >= SLIDES.length - 1) {
      void finish('sign-up');
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>LeafCare</Text>
        <TextButton label="Skip" onPress={() => void finish('sign-up')} tone="muted" />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide) => (
          <View key={slide.key} style={styles.slide}>
            <View style={styles.artWrap}>
              <slide.Art size={230} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, dotIndex) => (
            <View
              key={slide.key}
              style={[styles.dot, dotIndex === index ? styles.dotActive : undefined]}
            />
          ))}
        </View>
        <Button label={isLast ? 'Get Started' : 'Next'} onPress={advance} />
        <Pressable accessibilityRole="button" onPress={() => void finish('sign-in')}>
          <Text style={styles.loginHint}>Already have an account? Log in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  brand: { fontSize: 16, fontWeight: '800', color: palette.forest, letterSpacing: -0.3 },
  slide: { width, paddingHorizontal: spacing.xxl, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  artWrap: { alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.7,
    textAlign: 'center',
    lineHeight: 33,
  },
  body: { fontSize: 15, lineHeight: 22, color: palette.muted, textAlign: 'center', maxWidth: 320 },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.ring },
  dotActive: { width: 24, backgroundColor: palette.forest },
  loginHint: { textAlign: 'center', color: palette.muted, fontSize: 13, fontWeight: '600' },
});
