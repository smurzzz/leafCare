/**
 * 23 — Delete account confirmation. Lives at its own route so the confirmation
 * survives a navigation and reads the live plant count for the locked copy.
 */

import { useAuth } from '@clerk/expo';
import { spacing } from '@leafcare/shared';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WarningIcon } from '@/components/icons';
import { Button, Card, IconWell, TextButton } from '@/components/ui/primitives';
import { cancelAllReminders } from '@/lib/notifications';
import { useDeleteAccount, useMe } from '@/lib/queries';
import { useSettings } from '@/theme/settings-provider';

export default function DeleteAccountRoute() {
  const router = useRouter();
  const { colors } = useSettings();
  const { signOut } = useAuth();
  const me = useMe();
  const remove = useDeleteAccount();

  const plantCount = me.data?.stats.plants ?? 0;

  const confirm = async () => {
    await remove.mutateAsync();
    await cancelAllReminders().catch(() => undefined);
    await signOut();
    router.replace('/(auth)/sign-up');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.overlay }]}>
      <View style={styles.center}>
        <Card style={styles.modal}>
          <IconWell size={52} tone="coral">
            <WarningIcon size={24} color={colors.coralDeep} />
          </IconWell>

          <Text style={[styles.title, { color: colors.ink }]}>Delete account?</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            This permanently deletes your {plantCount} plant{plantCount === 1 ? '' : 's'}, care
            history and streaks. This action cannot be undone.
          </Text>

          <View style={styles.actions}>
            <Button
              label="Cancel"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => router.back()}
            />
            <Button
              label="Delete"
              variant="danger"
              style={{ flex: 1 }}
              loading={remove.isPending}
              onPress={() => void confirm()}
            />
          </View>

          <TextButton
            label="Keep my account"
            tone="muted"
            onPress={() => router.back()}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modal: { width: '100%', alignItems: 'center', gap: spacing.md, padding: spacing.xxl },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  body: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch', marginTop: spacing.sm },
});
