/**
 * 22 — Settings / account. Email, change password, theme, units, about and the
 * coral danger zone.
 */

import { spacing, type ThemeValue, type UnitSystemValue } from '@leafcare/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronRightIcon, LockIcon, TrashIcon, WarningIcon } from '@/components/icons';
import { SegmentedControl, TextField } from '@/components/ui/inputs';
import { Sheet } from '@/components/ui/misc';
import { Button, Card, IconWell, ScreenHeader, SectionLabel, TextButton } from '@/components/ui/primitives';
import { versionLabel } from '@/lib/config';
import { useMe, useUpdateMe } from '@/lib/queries';
import { useSettings } from '@/theme/settings-provider';

const TERMS_URL = 'https://leafcare.app/terms';
const PRIVACY_URL = 'https://leafcare.app/privacy';

export default function SettingsRoute() {
  const router = useRouter();
  const { colors, theme, units, setTheme, setUnits } = useSettings();
  const me = useMe();
  const updateMe = useUpdateMe();

  const [passwordOpen, setPasswordOpen] = useState(false);

  const profile = me.data?.profile;
  const serverName = profile?.fullName ?? '';

  const [name, setName] = useState(serverName);
  const [seededName, setSeededName] = useState(serverName);

  // Adjust during render rather than in an effect (React's "store information from previous
  // renders"): the name arrives after mount, and an effect here would paint an empty field
  // first. Typing is never clobbered, because this only fires when the server value changes.
  if (serverName !== seededName) {
    setSeededName(serverName);
    setName(serverName);
  }

  const changeTheme = (next: ThemeValue) => {
    void setTheme(next);
    updateMe.mutate({ theme: next });
  };

  const changeUnits = (next: UnitSystemValue) => {
    void setUnits(next);
    updateMe.mutate({ units: next });
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Settings"
          subtitle="Account and preferences"
          onBack={() => router.back()}
        />

        <View style={{ gap: spacing.md }}>
          <SectionLabel>Account</SectionLabel>
          <Card style={{ gap: spacing.md }}>
            <View style={styles.row}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Email</Text>
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                {profile?.email ?? '—'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPasswordOpen(true)}
              style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.ring, paddingTop: spacing.lg }]}
            >
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>
                  Change password
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  Clerk manages your credentials. We email a code to confirm it is you.
                </Text>
              </View>
              <ChevronRightIcon size={16} color={colors.muted} />
            </Pressable>
            <TextField label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
            <Button
              label="Save name"
              variant="secondary"
              loading={updateMe.isPending}
              onPress={() => updateMe.mutate({ fullName: name.trim() })}
            />
          </Card>
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionLabel>Preferences</SectionLabel>
          <Card style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>Theme</Text>
              <SegmentedControl<ThemeValue>
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'system', label: 'System' },
                  { value: 'dark', label: 'Dark' },
                ]}
                value={theme}
                onChange={changeTheme}
              />
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>Units</Text>
              <SegmentedControl<UnitSystemValue>
                options={[
                  { value: 'metric', label: 'Metric' },
                  { value: 'imperial', label: 'Imperial' },
                ]}
                value={units}
                onChange={changeUnits}
              />
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Volumes show as {units === 'metric' ? 'millilitres' : 'fluid ounces'}.
              </Text>
            </View>
          </Card>
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionLabel>About</SectionLabel>
          <Card style={{ padding: 0 }}>
            <View style={styles.aboutRow}>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>Version</Text>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>
                {versionLabel()}
              </Text>
            </View>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(TERMS_URL)}
              style={[styles.aboutRow, { borderTopWidth: 1, borderTopColor: colors.ring }]}
            >
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>Terms of Service</Text>
              <ChevronRightIcon size={16} color={colors.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(PRIVACY_URL)}
              style={[styles.aboutRow, { borderTopWidth: 1, borderTopColor: colors.ring }]}
            >
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>Privacy Policy</Text>
              <ChevronRightIcon size={16} color={colors.muted} />
            </Pressable>
          </Card>
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionLabel>Danger zone</SectionLabel>
          <Card tone="coral" style={styles.danger}>
            <IconWell size={40} tone="coral">
              <WarningIcon size={20} color={colors.coralDeep} />
            </IconWell>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.coralDeep, fontSize: 15, fontWeight: '800' }}>
                Delete account
              </Text>
              <Text style={{ color: colors.coralDeep, fontSize: 12, lineHeight: 18, opacity: 0.85 }}>
                Deleting your account removes your plants, care history and streaks. This cannot be
                undone.
              </Text>
            </View>
            <TrashIcon size={18} color={colors.coralDeep} />
          </Card>
          <Button
            label="Delete account"
            variant="danger"
            onPress={() => router.push('/settings/delete-account')}
          />
        </View>

        <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>
          LeafCare stores your plants in Supabase and your identity in Clerk. Photos stay on your
          device unless you save a plant.
        </Text>
      </ScrollView>

      <Sheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} title="Change password">
        <View style={{ gap: spacing.md }}>
          <IconWell size={40} tone="mint">
            <LockIcon size={18} color={colors.forest} />
          </IconWell>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
            We send a 6-digit code to {profile?.email ?? 'your email'}. Enter it on the next screen to
            choose a new password.
          </Text>
          <Button
            label="Send code"
            onPress={() => {
              setPasswordOpen(false);
              router.push('/(auth)/forgot-password');
            }}
          />
          <TextButton label="Cancel" tone="muted" onPress={() => setPasswordOpen(false)} />
        </View>
      </Sheet>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  danger: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
