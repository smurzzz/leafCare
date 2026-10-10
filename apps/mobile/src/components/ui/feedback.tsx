/**
 * Global feedback states: toast (27), skeletons + offline banner (26),
 * empty reminders (19) and the error screen (25).
 */

import { radius, spacing } from '@leafcare/shared';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useAnimatedValue, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { config } from '@/lib/config';
import { toastBus, type ToastEvent, type ToastVariant } from '@/lib/toast-bus';
import { useTheme } from '@/theme/settings-provider';

import { Button, Circle, TextButton } from './primitives';

/* ------------------------------------------------------------------- toast */

const TOAST_VISIBLE_MS = 3000;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<ToastEvent | null>(null);
  const translate = useAnimatedValue(-120);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = toastBus.subscribe((next) => {
      setEvent(next);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(translate, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(() => {
        Animated.timing(translate, {
          toValue: -140,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => setEvent(null));
      }, TOAST_VISIBLE_MS);
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [translate]);

  const background = useMemo(() => {
    if (!event) return colors.toast;
    const variants: Record<ToastVariant, string> = {
      success: colors.toast,
      error: colors.coralDeep,
      info: colors.forest,
    };
    return variants[event.variant];
  }, [event, colors]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {event ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            { backgroundColor: background, top: insets.top + 8, transform: [{ translateY: translate }] },
          ]}
        >
          <View style={styles.toastDrop}>
            <Circle size={18} color="rgba(255,255,255,0.22)">
              <Text style={{ fontSize: 10 }}>💧</Text>
            </Circle>
          </View>
          <Text style={styles.toastText}>{event.message}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
};

export const useToast = () => toastBus;

/* ---------------------------------------------------------------- skeleton */

export const Skeleton = ({
  width = '100%',
  height = 16,
  radiusValue = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radiusValue?: number;
  style?: object;
}) => {
  const { colors } = useTheme();
  const opacity = useAnimatedValue(0.45);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radiusValue, backgroundColor: colors.surfaceAlt, opacity },
        style,
      ]}
    />
  );
};

/** Home-shaped skeleton used while the first fetch is in flight. */
export const HomeSkeleton = () => (
  <View style={{ gap: spacing.lg }}>
    <Skeleton width="45%" height={12} />
    <Skeleton width="60%" height={26} radiusValue={10} />
    <Skeleton height={96} radiusValue={radius.card} />
    <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} height={76} radiusValue={radius.card} />
      ))}
    </View>
  </View>
);

export const CardGridSkeleton = () => (
  <View style={{ gap: spacing.lg }}>
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Skeleton width="48%" height={196} radiusValue={radius.card} />
      <Skeleton width="48%" height={196} radiusValue={radius.card} />
    </View>
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Skeleton width="48%" height={196} radiusValue={radius.card} />
      <Skeleton width="48%" height={196} radiusValue={radius.card} />
    </View>
  </View>
);

/* --------------------------------------------------------- offline banner */

export const OfflineBanner = ({ children }: { children?: ReactNode }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: colors.coralSoft }]}>
      <Text style={[styles.bannerText, { color: colors.coralDeep }]}>No connection</Text>
      {children}
    </View>
  );
};

/** Fixed banner that appears above the content whenever NetInfo is offline. */
export const OfflineBannerHost = ({ message }: { message?: string }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.bannerHost,
        { backgroundColor: colors.coralSoft, top: 0, paddingTop: insets.top + 6 },
      ]}
    >
      <Text style={[styles.bannerText, { color: colors.coralDeep }]}>
        No connection{message ? ` · ${message}` : ''}
      </Text>
    </View>
  );
};

/* ------------------------------------------------------------ empty state */

export const EmptyState = ({
  illustration,
  title,
  body,
  actionLabel,
  onAction,
}: {
  illustration?: ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      {illustration}
      <Text style={[styles.emptyTitle, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.muted }]}>{body}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ alignSelf: 'stretch', marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
};

/* ------------------------------------------------------------ error state */

export const ErrorState = ({
  onRetry,
  title = 'Something went wrong',
  body = "We couldn’t reach LeafCare. Check your connection and try again — your plants are safe.",
  illustration,
}: {
  onRetry?: () => void;
  title?: string;
  body?: string;
  illustration?: ReactNode;
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      {illustration}
      <Text style={[styles.emptyTitle, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.muted }]}>{body}</Text>
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} style={{ alignSelf: 'stretch', marginTop: spacing.sm }} />
      ) : null}
      <ContactSupportLink />
    </View>
  );
};

export const ContactSupportLink = () => {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        toastBus.show(`Email ${config.supportEmail}`, 'info');
      }}
      style={{ paddingVertical: spacing.md }}
    >
      <Text style={[styles.supportLink, { color: colors.muted }]}>
        Contact support · {config.supportEmail}
      </Text>
    </Pressable>
  );
};

/* ---------------------------------------------------------------- loading */

export const InlineLoading = ({ label }: { label?: string }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.inlineLoading}>
      <Skeleton width={26} height={26} radiusValue={13} />
      {label ? <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text> : null}
    </View>
  );
};

export const RetryHint = ({ onPress, label = 'Tap to retry' }: { onPress: () => void; label?: string }) => (
  <TextButton label={label} onPress={onPress} tone="muted" />
);

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 100,
  },
  toastText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', flex: 1 },
  toastDrop: { width: 20, alignItems: 'center', justifyContent: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  bannerHost: { position: 'absolute', left: 0, right: 0, zIndex: 90, paddingBottom: 8 },
  bannerText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  emptyWrap: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  supportLink: { fontSize: 12, fontWeight: '600' },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
