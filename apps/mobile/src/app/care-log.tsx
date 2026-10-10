/**
 * 17 — Care log. Month calendar with watered/missed dots, the mint summary and
 * the recent-activity feed (also reachable filtered to a single plant).
 */

import { spacing } from '@leafcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalendarGrid } from '@/components/ui/date-picker-sheet';
import { ErrorState } from '@/components/ui/feedback';
import { PlantPhoto } from '@/components/ui/misc';
import { Card, SectionLabel, ScreenHeader, TextButton } from '@/components/ui/primitives';
import { amountLabel, deviceTimeZone, formatIsoStamp, monthKeyFromDate, todayDateKey } from '@/lib/format';
import { useCareLog } from '@/lib/queries';
import { useSettings } from '@/theme/settings-provider';

export default function CareLogRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ plantId?: string }>();
  const { colors, units } = useSettings();
  const timeZone = deviceTimeZone();

  const month = monthKeyFromDate(new Date(), timeZone);
  const careLog = useCareLog(month, params.plantId, true);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const data = careLog.data;
  const todayKey = todayDateKey(timeZone);

  const recent = useMemo(() => {
    const all = data?.recent ?? [];
    if (!selectedDay) return all;
    return all.filter((entry) => entry.occurredAt.slice(0, 10) === selectedDay);
  }, [data?.recent, selectedDay]);

  const deltaLabel = (() => {
    if (!data) return '';
    if (data.deltaVsPrevMonth === 0) return 'same as last month';
    const word = data.deltaVsPrevMonth > 0 ? 'more' : 'fewer';
    return `${Math.abs(data.deltaVsPrevMonth)} ${word} than last month`;
  })();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Care log"
          subtitle={data?.monthLabel ?? 'This month'}
          onBack={() => router.back()}
        />

        {careLog.isError && !data ? (
          <ErrorState onRetry={() => void careLog.refetch()} />
        ) : null}

        <Card style={{ gap: spacing.lg }}>
          <CalendarGrid
            timeZone={timeZone}
            selectedKey={selectedDay}
            onSelect={(key) => setSelectedDay((current) => (current === key ? null : key))}
            maxMonthKey={month}
            dayState={(key) => data?.days[key] ?? 'empty'}
          />

          <View style={styles.legend}>
            <Legend color={colors.forest} label="Watered" />
            <Legend color={colors.coral} label="Missed" />
            <Legend color={colors.ring} label="No data" />
          </View>
        </Card>

        <Card tone="mint" style={{ gap: spacing.sm }}>
          <Text style={[styles.summaryTitle, { color: colors.forestDeep }]}>
            {data?.wateringsThisMonth ?? 0} waterings this month
          </Text>
          <Text style={[styles.summaryBody, { color: colors.forestDeep }]}>
            {deltaLabel} · {data?.missedDays ?? 0} missed day
            {(data?.missedDays ?? 0) === 1 ? '' : 's'}
          </Text>
          {selectedDay ? (
            <TextButton
              label={`Showing ${selectedDay} · clear filter`}
              onPress={() => setSelectedDay(null)}
            />
          ) : null}
        </Card>

        <View style={{ gap: spacing.md }}>
          <SectionLabel>Recent activity</SectionLabel>
          {recent.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Nothing logged {selectedDay ? `on ${selectedDay}` : 'this month'} yet.
            </Text>
          ) : (
            recent.map((entry) => (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                onPress={() => router.push(`/plants/${entry.plantId}`)}
                style={[styles.activityRow, { borderBottomColor: colors.ring }]}
              >
                <PlantPhoto uri={entry.photoUrl} nickname={entry.plantNickname} size={44} radiusValue={12} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.activityTitle, { color: colors.ink }]} numberOfLines={1}>
                    {entry.type === 'watered'
                      ? `${amountLabel(entry.amountMl, units)} · ${entry.plantNickname}`
                      : entry.type === 'snoozed'
                        ? `Snoozed · ${entry.plantNickname}`
                        : `Missed · ${entry.plantNickname}`}
                  </Text>
                  <Text style={[styles.activityMeta, { color: colors.muted }]}>
                    {formatIsoStamp(entry.occurredAt, timeZone)}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        <Text style={[styles.footnote, { color: colors.muted }]}>
          {todayKey} · times shown in your device timezone ({timeZone})
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const Legend = ({ color, label }: { color: string; label: string }) => {
  const { colors } = useSettings();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl },
  legend: { flexDirection: 'row', gap: spacing.xl, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  summaryTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  summaryBody: { fontSize: 13, opacity: 0.75 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  activityTitle: { fontSize: 14, fontWeight: '700' },
  activityMeta: { fontSize: 11, marginTop: 2 },
  footnote: { fontSize: 11, textAlign: 'center' },
});
