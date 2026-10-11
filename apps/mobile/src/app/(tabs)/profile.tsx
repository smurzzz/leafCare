/**
 * 21 — Profile. Avatar, stats, achievements, account shortcuts and log out.
 * Also the place where the server's theme/units values hydrate the device.
 */

import { useAuth } from '@clerk/expo';
import { spacing } from '@leafcare/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BellIcon,
  CalendarIcon,
  ChevronRightIcon,
  GearIcon,
  LogoutIcon,
  ShieldIcon,
} from '@/components/icons';
import { ErrorState } from '@/components/ui/feedback';
import { TextField } from '@/components/ui/inputs';
import { AchievementChip, Avatar, Sheet, StatBlock, TipCard } from '@/components/ui/misc';
import { Button, Card, IconButton, SectionLabel, TextButton } from '@/components/ui/primitives';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { cancelAllReminders } from '@/lib/notifications';
import {
  clearUserCaches,
  useMe,
  useRemoveAvatar,
  useUpdateMe,
  useUploadAvatar,
} from '@/lib/queries';
import { useSettings } from '@/theme/settings-provider';

export default function ProfileRoute() {
  const router = useRouter();
  const { colors } = useSettings();
  const { hydrate } = useSettings();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const me = useMe();
  const updateMe = useUpdateMe();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();

  // Total plants, current streak and waterings are counted server-side on every
  // read of /api/me, so the number on this card is only as fresh as the last
  // request. Watering a plant invalidates it; arriving at this tab and pulling
  // down are the other two ways it moves.
  const pull = usePullToRefresh(() => me.refetch());
  useRefreshOnFocus(me);

  const [editOpen, setEditOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const profile = me.data?.profile;
  const serverName = profile?.fullName ?? '';

  const [name, setName] = useState(serverName);
  const [seededName, setSeededName] = useState(serverName);

  // React's "adjust state when a prop changes" pattern: the profile arrives from the API
  // after the first render, so the editable name is seeded during render rather than in an
  // effect, which would render the field empty once before filling it in.
  if (serverName !== seededName) {
    setSeededName(serverName);
    setName(serverName);
  }

  useEffect(() => {
    if (!profile) return;
    hydrate({ theme: profile.theme, units: profile.units });
  }, [profile, hydrate]);

  if (me.isError && !me.data) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
        <ErrorState onRetry={() => void me.refetch()} />
      </SafeAreaView>
    );
  }

  const stats = me.data?.stats;
  const achievements = me.data?.achievements ?? [];

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            tintColor={colors.forest}
            colors={[colors.forest]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.ink }]}>Profile</Text>
          <IconButton accessibilityLabel="Settings" onPress={() => router.push('/settings')}>
            <GearIcon size={19} color={colors.ink} />
          </IconButton>
        </View>

        <View style={styles.identity}>
          <Avatar uri={profile?.avatarUrl ?? null} name={profile?.fullName ?? 'You'} size={76} />
          <Text style={[styles.name, { color: colors.ink }]}>{profile?.fullName ?? 'Your account'}</Text>
          <Text style={[styles.email, { color: colors.muted }]}>{profile?.email ?? ''}</Text>
        </View>

        <Card style={styles.statsCard}>
          <StatBlock value={`${stats?.plants ?? 0}`} label="Total plants" />
          <View style={[styles.statDivider, { backgroundColor: colors.ring }]} />
          <StatBlock value={`${stats?.streakDays ?? 0}d`} label="Current streak" />
          <View style={[styles.statDivider, { backgroundColor: colors.ring }]} />
          <StatBlock value={`${stats?.waterings ?? 0}`} label="Waterings" />
        </Card>

        <View style={{ gap: spacing.md }}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>Achievements</Text>
            <Text style={[styles.sectionMeta, { color: colors.muted }]}>
              {stats?.achievementsUnlocked ?? 0} of {stats?.achievementsTotal ?? 4} unlocked
            </Text>
          </View>
          <View style={styles.achievementGrid}>
            {achievements.map((achievement) => (
              <AchievementChip
                key={achievement.key}
                title={achievement.title}
                unlocked={achievement.unlocked}
                hint={achievement.unlocked ? 'Unlocked' : undefined}
              />
            ))}
          </View>
        </View>

        <Card style={{ padding: 0 }}>
          <MenuRow
            icon={<ShieldIcon size={18} color={colors.forest} />}
            label="Edit profile"
            onPress={() => setEditOpen(true)}
          />
          <MenuRow
            icon={<BellIcon size={18} color={colors.forest} />}
            label="Notification settings"
            onPress={() => router.push('/settings/notifications')}
          />
          <MenuRow
            icon={<CalendarIcon size={18} color={colors.forest} />}
            label="Care log"
            onPress={() => router.push('/care-log')}
          />
          <MenuRow
            icon={<ShieldIcon size={18} color={colors.forest} />}
            label="Privacy"
            onPress={() => setPrivacyOpen(true)}
          />
          <MenuRow
            icon={<GearIcon size={18} color={colors.forest} />}
            label="Help & support"
            last
            onPress={() =>
              Alert.alert('Help & support', 'Email us at support@leafcare.app and we will reply.')
            }
          />
        </Card>

        <Button
          label="Log out"
          variant="danger"
          icon={<LogoutIcon size={18} color="#FFFFFF" />}
          onPress={() => void onLogOut()}
        />
      </ScrollView>

      <Sheet visible={editOpen} onClose={() => setEditOpen(false)} title="Edit profile">
        <View style={styles.photoRow}>
          <Avatar uri={profile?.avatarUrl ?? null} name={profile?.fullName ?? 'You'} size={64} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Button
              label={uploadAvatar.isPending ? 'Uploading…' : 'Change photo'}
              variant="secondary"
              disabled={uploadAvatar.isPending}
              onPress={() => void pickAvatar()}
            />
            {profile?.avatarUrl ? (
              <TextButton
                label="Remove photo"
                tone="muted"
                onPress={() => removeAvatar.mutate()}
              />
            ) : (
              <Text style={[styles.sectionMeta, { color: colors.muted }]}>
                No photo yet — LeafCare draws your initials.
              </Text>
            )}
          </View>
        </View>
        <TextField label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Button
          label="Save"
          loading={updateMe.isPending}
          onPress={() => {
            updateMe.mutate({ fullName: name.trim() });
            setEditOpen(false);
          }}
        />
      </Sheet>

      <Sheet visible={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Privacy">
        <TipCard
          title="Your photos"
          body="Photos stay on your device unless you choose to save them. Identification sends the image to LeafCare’s own server, which talks to the plant identification provider; we never send your photos to analytics or advertisers."
        />
        <Text style={[styles.sectionMeta, { color: colors.muted }]}>
          Account deletion removes your plants, photos, care history and streaks.
        </Text>
        <TextButton label="Close" onPress={() => setPrivacyOpen(false)} tone="muted" />
      </Sheet>
    </SafeAreaView>
  );

  /** Camera roll, cropped square, uploaded straight to our API (never a third party). */
  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.uri) return;
    uploadAvatar.mutate({ uri: asset.uri });
  }

  async function onLogOut() {
    await cancelAllReminders().catch(() => undefined);
    // Leave nothing of this account on the device for the next person to see.
    await clearUserCaches(queryClient).catch(() => undefined);
    await signOut();
    router.replace('/(auth)/sign-in');
  }
}

const MenuRow = ({
  icon,
  label,
  onPress,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  last?: boolean;
}) => {
  const { colors } = useSettings();
  return (
    <View
      style={[
        styles.menuRow,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.ring },
      ]}
    >
      <IconButton accessibilityLabel={label} onPress={onPress} size={36} variant="mint" style={{ backgroundColor: 'transparent' }}>
        {icon}
      </IconButton>
      <Text
        style={[styles.menuLabel, { color: colors.ink }]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {label}
      </Text>
      <ChevronRightIcon size={16} color={colors.muted} />
    </View>
  );
};

export { SectionLabel };

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl + 80, gap: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8 },
  identity: { alignItems: 'center', gap: spacing.sm },
  name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginTop: spacing.sm },
  email: { fontSize: 13 },
  statsCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.lg },
  statDivider: { width: 1, height: 34 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionMeta: { fontSize: 12, fontWeight: '600' },
  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingRight: spacing.lg },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: spacing.lg },
});
