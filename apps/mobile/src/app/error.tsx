/**
 * 25 — Error. Used for identify/API/auth hard failures, never for validation.
 * "Try again" replays the last failed action when it is replayable.
 */

import { spacing } from '@leafcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CrackedPotArt } from '@/components/illustrations';
import { Button, TextButton } from '@/components/ui/primitives';
import { config } from '@/lib/config';
import { getScanSession } from '@/lib/scan-session';
import { useSettings } from '@/theme/settings-provider';

export default function ErrorRoute() {
  const router = useRouter();
  const { colors } = useSettings();
  const params = useLocalSearchParams<{ message?: string; retry?: string }>();

  const message =
    params.message && params.message.length > 0
      ? params.message
      : "We couldn’t reach LeafCare. Check your connection and try again — your plants are safe.";

  const tryAgain = () => {
    // Replay what failed: the identify request can be retried while the captured
    // photo is still in the scan session.
    if (params.retry === 'identify' && getScanSession()) {
      router.replace('/scan/identifying');
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <CrackedPotArt size={180} />
        <Text style={[styles.title, { color: colors.ink }]}>Something went wrong</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{message}</Text>

        <View style={styles.actions}>
          <Button label="Try again" onPress={tryAgain} />
          <TextButton
            label={`Contact support · ${config.supportEmail}`}
            tone="muted"
            onPress={() =>
              void Linking.openURL(
                `mailto:${config.supportEmail}?subject=LeafCare%20support&body=${encodeURIComponent(message)}`,
              )
            }
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.7, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.lg, alignItems: 'center', marginTop: spacing.md },
});
