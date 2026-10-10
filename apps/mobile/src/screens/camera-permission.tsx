/**
 * 24 — Camera permission. Shown at /scan while the permission is undetermined
 * or denied, with an OS-settings deep link once it has been refused.
 */

import { palette, spacing } from '@leafcare/shared';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { CameraPermissionArt } from '@/components/illustrations';
import { Button, TextButton } from '@/components/ui/primitives';

export const CameraPermissionState = ({
  canAskAgain,
  onAllow,
  onNotNow,
  onOpenSettings,
  busy,
}: {
  canAskAgain: boolean;
  onAllow: () => void;
  onNotNow: () => void;
  onOpenSettings: () => void;
  busy?: boolean;
}) => (
  <View style={styles.wrap}>
    <CameraPermissionArt size={190} />
    <Text style={styles.title}>Allow camera access</Text>
    <Text style={styles.body}>
      LeafCare uses your camera to identify plants. Photos stay on your device unless you choose to
      save them.
    </Text>
    <View style={styles.actions}>
      <Button
        label={canAskAgain ? 'Allow camera' : 'Open settings'}
        loading={busy}
        onPress={canAskAgain ? onAllow : onOpenSettings}
      />
      <TextButton label="Not now" tone="muted" onPress={onNotNow} />
    </View>
  </View>
);

export const openAppSettings = (): void => {
  void Linking.openSettings().catch(() => undefined);
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
    backgroundColor: palette.cream,
  },
  title: { fontSize: 26, fontWeight: '800', color: palette.ink, letterSpacing: -0.6, textAlign: 'center' },
  body: { fontSize: 14, color: palette.muted, textAlign: 'center', lineHeight: 21 },
  actions: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.md, alignItems: 'center' },
});
