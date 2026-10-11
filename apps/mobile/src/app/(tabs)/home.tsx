/**
 * 08 — Home / Today. Greeting, the mint due card with the watering ring, today's
 * care list with optimistic water actions, and the upcoming preview.
 */

import { palette, spacing } from '@leafcare/shared';
import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BellIcon, FlameIcon, ScanFrameIcon } from '@/components/icons';
import { SleepingPlantArt } from '@/components/illustrations';
import { ErrorState, HomeSkeleton } from '@/components/ui/feedback';
import { CareRow, PlantPhoto, ProgressRing } from '@/components/ui/misc';
import { Avatar, Button, Chip, IconButton, SectionHeading } from '@/components/ui/primitives';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useHome, useMe, usePlants, useWaterPlant } from '@/lib/queries';
import { useSettings } from '@/theme/settings-provider';

export default function HomeRoute() {
  const router = useRouter();
  const { colors } = useSettings();
  const home = useHome();
  const me = useMe();
  const plants = usePlants();
  const water = useWaterPlant();

  // The streak, the due count and the waterings all live on the server, and the
  // tab stays mounted once visited — so the pull gesture and the return to this
  // tab are what keep them honest. All three queries move together, because the
  // screen reads all three: the today list resolves its rows against the plants.
  const pull = usePullToRefresh(async () => {
    await Promise.all([home.refetch(), me.refetch(), plants.refetch()]);
  });
  useRefreshOnFocus(home, me, plants);

  const data = home.data;

  const openPlant = (plantId: string) => router.push(`/plants/${plantId}`);
  const openNotifications = () => router.push('/(tabs)/reminders');

  if (home.isLoading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <HomeSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  if (home.isError && !data) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
        <ErrorState
          onRetry={() => void home.refetch()}
          illustration={<SleepingPlantArt size={130} />}
        />
      </SafeAreaView>
    );
  }

  const isEmpty = (plants.data?.plants.length ?? 0) === 0;

  if (isEmpty) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Header
            overline={data?.overline ?? ''}
            greeting={data?.greeting ?? 'Welcome'}
            avatarUrl={me.data?.profile.avatarUrl ?? null}
            name={me.data?.profile.fullName ?? 'You'}
            onProfile={() => router.push('/(tabs)/profile')}
            onBell={openNotifications}
          />
          <View style={styles.emptyWrap}>
            <SleepingPlantArt size={170} />
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>No plants yet</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>
              Add your first plant and LeafCare will build a watering schedule around it.
            </Text>
            <Button label="Add a plant" onPress={() => router.push('/scan')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={data?.today ?? []}
        keyExtractor={(item) => item.plantId}
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
        ListHeaderComponent={
          <View style={{ gap: spacing.lg }}>
            <Header
              overline={data?.overline ?? ''}
              greeting={data?.greeting ?? 'Welcome'}
              avatarUrl={me.data?.profile.avatarUrl ?? null}
              name={me.data?.profile.fullName ?? 'You'}
              onProfile={() => router.push('/(tabs)/profile')}
              onBell={openNotifications}
            />

            <View style={[styles.dueCard, { backgroundColor: colors.mint }]}>
              <ProgressRing value={data?.progress ?? 0} size={72} thickness={8} track={colors.surface}>
                <Text style={{ fontSize: 20 }}>💧</Text>
              </ProgressRing>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.dueTitle, { color: colors.ink }]}>
                  {data?.dueCount ?? 0} {(data?.dueCount ?? 0) === 1 ? 'plant needs' : 'plants need'} water today
                </Text>
                <Text style={[styles.dueBody, { color: colors.forestDeep }]}>{data?.headline}</Text>
              </View>
            </View>

            <View style={styles.rowBetween}>
              <SectionHeading title="Today’s care" />
              <Chip
                tone="streak"
                label={`${data?.streakDays ?? 0}-day streak`}
                icon={<FlameIcon size={13} color={colors.streak} />}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const plant = (plants.data?.plants ?? []).find((entry) => entry.id === item.plantId);
          if (!plant) return null;
          return (
            <View style={{ marginTop: spacing.md }}>
              <CareRow
                plant={plant}
                onPress={() => openPlant(plant.id)}
                onWater={() =>
                  water.mutate({ plantId: plant.id, nickname: plant.nickname, source: 'home' })
                }
                watering={water.isPending && water.variables?.plantId === plant.id}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.allDone, { backgroundColor: colors.surface, borderColor: colors.ring }]}>
            <Text style={{ fontSize: 22 }}>✅</Text>
            <Text style={[styles.allDoneText, { color: colors.muted }]}>
              Everything is watered. Come back tomorrow for the next round.
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
            <SectionHeading
              title="Upcoming"
              action="See all"
              onAction={() => router.push('/(tabs)/plants')}
            />
            {(data?.upcoming ?? []).map((row) => (
              <View
                key={`${row.plantId}-upcoming`}
                style={[styles.upcomingRow, { borderBottomColor: colors.ring }]}
              >
                <PlantPhoto uri={row.photoUrl} nickname={row.nickname} size={44} radiusValue={14} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.upcomingName, { color: colors.ink }]} numberOfLines={1}>
                    {row.nickname}
                  </Text>
                  <Text style={[styles.upcomingSub, { color: colors.muted }]} numberOfLines={1}>
                    {row.species ?? 'Houseplant'}
                  </Text>
                </View>
                <Text style={[styles.upcomingWhen, { color: colors.muted }]}>
                  {row.statusLabel}
                </Text>
              </View>
            ))}
            {(data?.upcoming ?? []).length === 0 ? (
              <Text style={[styles.upcomingEmpty, { color: colors.muted }]}>
                Nothing scheduled in the next few days.
              </Text>
            ) : null}

            <Button
              label="Identify a plant"
              variant="secondary"
              icon={<ScanFrameIcon size={18} color={colors.forest} />}
              onPress={() => router.push('/scan')}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const Header = ({
  overline,
  greeting,
  avatarUrl,
  name,
  onProfile,
  onBell,
}: {
  overline: string;
  greeting: string;
  avatarUrl: string | null;
  name: string;
  onProfile: () => void;
  onBell: () => void;
}) => {
  const { colors } = useSettings();
  return (
    <View style={styles.rowBetween}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.overline, { color: colors.muted }]}>{overline}</Text>
        <View style={styles.greetingRow}>
          <Text style={[styles.greeting, { color: colors.ink }]} numberOfLines={1}>
            {greeting}
          </Text>
          <Text style={{ fontSize: 16 }}>🌿</Text>
        </View>
      </View>
      <View style={styles.bellRow}>
        <IconButton accessibilityLabel="Reminders" onPress={onBell}>
          <BellIcon size={18} color={colors.ink} />
          <View style={[styles.bellDot, { backgroundColor: colors.coral }]} />
        </IconButton>
        <IconButton accessibilityLabel="Open profile" onPress={onProfile} size={44} variant="mint" style={{ overflow: 'hidden' }}>
          <Avatar uri={avatarUrl} name={name} size={44} />
        </IconButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl + 80 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  greeting: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, flexShrink: 1 },
  bellRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md },
  bellDot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4 },
  dueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderRadius: 22,
    padding: spacing.lg,
  },
  dueTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  dueBody: { fontSize: 12, lineHeight: 17, opacity: 0.78 },
  allDone: {
    marginTop: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  allDoneText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  upcomingName: { fontSize: 15, fontWeight: '700' },
  upcomingSub: { fontSize: 12, marginTop: 2 },
  upcomingWhen: { fontSize: 12, fontWeight: '600' },
  upcomingEmpty: { fontSize: 13 },
  emptyWrap: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
  emptyTitle: { fontSize: 22, fontWeight: '800' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  placeholder: { color: palette.muted },
});
