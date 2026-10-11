/**
 * 18 — Reminders (populated) and 19 — Reminders (empty).
 * Grouped by Today / Tomorrow / This week with reveal actions for Done and
 * Snooze, plus the Completed segment.
 */

import { spacing, type ReminderItem } from '@leafcare/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckIcon, ClockIcon, GearIcon } from '@/components/icons';
import { SleepingPlantArt } from '@/components/illustrations';
import { ErrorState } from '@/components/ui/feedback';
import { SegmentedControl } from '@/components/ui/inputs';
import { PlantPhoto } from '@/components/ui/misc';
import { Button, Chip, IconButton, TitleText } from '@/components/ui/primitives';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useNotificationPrefs, useReminders, useSnoozeReminder, useWaterPlant } from '@/lib/queries';
import { useSettings } from '@/theme/settings-provider';

const GROUP_LABELS: Record<string, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  this_week: 'This week',
};

export default function RemindersRoute() {
  const router = useRouter();
  const { colors } = useSettings();
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [revealed, setRevealed] = useState<string | null>(null);

  const reminders = useReminders(tab);
  const prefs = useNotificationPrefs();
  const water = useWaterPlant();
  const snooze = useSnoozeReminder();

  // Due dates move on the server (a scheduled job, another device, the start of a
  // day), and a reminder that was snoozed elsewhere should not still read "Today"
  // here. The snooze preset is part of the gesture because it is part of the row.
  const pull = usePullToRefresh(async () => {
    await Promise.all([reminders.refetch(), prefs.refetch()]);
  });
  useRefreshOnFocus(reminders, prefs);

  const data = reminders.data;
  const isEmpty = tab === 'upcoming' && (data?.empty ?? false);

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <TitleText style={{ fontSize: 26 }}>Reminders</TitleText>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Watering reminders and nudges
          </Text>
        </View>
        <IconButton
          accessibilityLabel="Notification settings"
          onPress={() => router.push('/settings/notifications')}
        >
          <GearIcon size={19} color={colors.ink} />
        </IconButton>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <SegmentedControl
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'completed', label: 'Completed' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {reminders.isLoading ? (
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={{ height: 72, borderRadius: 20, backgroundColor: colors.surfaceAlt }}
            />
          ))}
        </View>
      ) : null}

      {reminders.isError && !data ? (
        <ErrorState onRetry={() => void reminders.refetch()} />
      ) : null}

      {isEmpty ? (
        <View style={styles.emptyWrap}>
          <SleepingPlantArt size={170} />
          <TitleText center style={{ fontSize: 22 }}>
            No reminders yet
          </TitleText>
          <Text style={[styles.emptyBody, { color: colors.muted }]}>
            Add a plant and LeafCare will build a watering schedule and remind you right on time.
          </Text>
          <Button label="Add a plant" onPress={() => router.push('/scan')} />
        </View>
      ) : null}

      {!isEmpty ? (
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
          {tab === 'upcoming'
            ? (data?.groups ?? []).map((group) => (
                <View key={group.key} style={{ gap: spacing.md }}>
                  <View style={styles.groupHeader}>
                    <Text style={[styles.groupLabel, { color: colors.muted }]}>
                      {GROUP_LABELS[group.key] ?? group.label}
                    </Text>
                    <Chip label={`${group.items.length}`} tone="neutral" />
                  </View>
                  {group.items.map((item) => (
                    <ReminderRow
                      key={`${group.key}-${item.plantId}`}
                      item={item}
                      revealed={revealed === `${group.key}-${item.plantId}`}
                      onToggle={() =>
                        setRevealed(
                          revealed === `${group.key}-${item.plantId}`
                            ? null
                            : `${group.key}-${item.plantId}`,
                        )
                      }
                      onOpen={() => router.push(`/plants/${item.plantId}`)}
                      onDone={() =>
                        water.mutate({
                          plantId: item.plantId,
                          nickname: item.nickname,
                          source: 'reminders',
                        })
                      }
                      onSnooze={() =>
                        snooze.mutate({
                          plantId: item.plantId,
                          preset: prefs.data?.snoozePreset ?? '3h',
                        })
                      }
                      busy={water.isPending || snooze.isPending}
                    />
                  ))}
                </View>
              ))
            : null}

          {tab === 'completed' ? (
            (data?.completed ?? []).length === 0 ? (
              <Text style={[styles.emptyBody, { color: colors.muted }]}>
                Nothing completed yet today.
              </Text>
            ) : (
              <View style={{ gap: spacing.md }}>
                <Text style={[styles.groupLabel, { color: colors.muted }]}>Completed today</Text>
                {(data?.completed ?? []).map((item) => (
                  <View
                    key={`done-${item.plantId}-${item.time}`}
                    style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.ring }]}
                  >
                    <PlantPhoto uri={item.photoUrl} nickname={item.nickname} size={48} radiusValue={14} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: colors.ink }]}>{item.title}</Text>
                      <Text style={[styles.rowTime, { color: colors.muted }]}>{item.time}</Text>
                    </View>
                    <View style={[styles.doneBadge, { backgroundColor: colors.mint }]}>
                      <CheckIcon size={14} color={colors.forest} />
                    </View>
                  </View>
                ))}
              </View>
            )
          ) : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const ReminderRow = ({
  item,
  revealed,
  onToggle,
  onOpen,
  onDone,
  onSnooze,
  busy,
}: {
  item: ReminderItem;
  revealed: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDone: () => void;
  onSnooze: () => void;
  busy?: boolean;
}) => {
  const { colors } = useSettings();
  return (
    <View
      style={[
        styles.rowCard,
        {
          backgroundColor: colors.surface,
          borderColor: item.overdue ? colors.coral : colors.ring,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title} at ${item.time}`}
        onPress={onOpen}
        style={styles.row}
      >
        <PlantPhoto uri={item.photoUrl} nickname={item.nickname} size={48} radiusValue={14} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.timeRow}>
            <ClockIcon size={13} color={colors.muted} />
            <Text style={[styles.rowTime, { color: colors.muted }]}>{item.time}</Text>
            {item.overdue ? (
              <Text style={[styles.rowTime, { color: colors.coralDeep, fontWeight: '700' }]}>
                · Overdue
              </Text>
            ) : null}
          </View>
        </View>
        <IconButton
          accessibilityLabel={revealed ? 'Hide actions' : 'Show actions'}
          onPress={onToggle}
          size={36}
          variant="mint"
        >
          <Text style={{ color: colors.forest, fontWeight: '800' }}>•••</Text>
        </IconButton>
      </Pressable>

      {revealed ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mark ${item.nickname} watered`}
            onPress={onDone}
            disabled={busy}
            style={[styles.action, { backgroundColor: colors.forest }]}
          >
            <CheckIcon size={15} color="#FFFFFF" />
            <Text style={styles.actionLabel}>Done</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Snooze ${item.nickname}`}
            onPress={onSnooze}
            disabled={busy}
            style={[styles.action, { backgroundColor: colors.blue }]}
          >
            <ClockIcon size={15} color="#FFFFFF" />
            <Text style={styles.actionLabel}>Snooze</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  subtitle: { fontSize: 12, marginTop: 2 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl + 80, gap: spacing.xxl },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  rowCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  rowTime: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 14,
  },
  actionLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  doneBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl * 1.5, paddingHorizontal: spacing.xxl },
  emptyBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
