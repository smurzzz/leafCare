/**
 * 20 — Notification settings. Toggles, daily digest time, snooze preset and the
 * overdue nudge, persisted on notification_prefs.
 */

import { formatClockTime, spacing, type SnoozePreset } from '@leafcare/shared';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ClockIcon } from '@/components/icons';
import { SegmentedControl, SwitchRow } from '@/components/ui/inputs';
import { TipCard } from '@/components/ui/misc';
import { Button, Card, ScreenHeader, SectionLabel } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/notifications';
import { useMe, useNotificationPrefs, useUpdateNotificationPrefs } from '@/lib/queries';
import { useSettings } from '@/theme/settings-provider';

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = [0, 15, 30, 45];

/** "HH:MM" → hours and minutes, falling back to 09:00 when the value is missing or malformed. */
const parseClock = (value: string) => {
  const [hour, minute] = value.split(':').map((part) => Number.parseInt(part, 10));
  return {
    hour: Number.isInteger(hour) ? hour : 9,
    minute: Number.isInteger(minute) ? minute : 0,
  };
};

export default function NotificationSettingsRoute() {
  const router = useRouter();
  const { colors } = useSettings();
  const prefs = useNotificationPrefs();
  const me = useMe();
  const update = useUpdateNotificationPrefs();

  const [timeOpen, setTimeOpen] = useState(false);

  const data = prefs.data;
  const streakDays = me.data?.stats.streakDays ?? 0;

  // The saved time is the source of truth until the user picks a new one, so the picker reads
  // from a draft instead of copying server state into state in an effect.
  const [draft, setDraft] = useState<{ hour: number; minute: number } | null>(null);
  const picked = draft ?? parseClock(data?.dailyDigestTime ?? '09:00');

  const digestTime = `${picked.hour.toString().padStart(2, '0')}:${picked.minute
    .toString()
    .padStart(2, '0')}`;

  const toggleReminders = async (value: boolean) => {
    update.mutate({ wateringReminders: value });
    if (!value) return;
    // Registering the device is what actually makes pushes arrive.
    const token = await registerForPushNotifications();
    if (token) await api.registerPushToken(token).catch(() => undefined);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Notifications"
          subtitle="Watering reminders and nudges"
          onBack={() => router.back()}
        />

        {streakDays >= 2 ? (
          <TipCard
            title={`You’re on a ${streakDays}-day streak`}
            body="Your reminders are on time. Keep it up."
          />
        ) : null}

        <Card>
          <SwitchRow
            title="Watering reminders"
            description="Push notifications when a plant is due."
            value={data?.wateringReminders ?? true}
            onValueChange={(value) => void toggleReminders(value)}
          />
        </Card>

        <View style={{ gap: spacing.md }}>
          <SectionLabel>Timing</SectionLabel>
          <Card style={{ gap: spacing.lg, padding: 0 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setTimeOpen((value) => !value)}
              style={[styles.row, { borderBottomColor: colors.ring }]}
            >
              <Text style={[styles.rowLabel, { color: colors.ink }]}>Daily reminder time</Text>
              <View style={[styles.valueChip, { backgroundColor: colors.mint }]}>
                <ClockIcon size={13} color={colors.forest} />
                <Text style={{ color: colors.forest, fontSize: 12, fontWeight: '800' }}>
                  {formatClockTime(digestTime)}
                </Text>
              </View>
            </Pressable>

            {timeOpen ? (
              <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
                <Text style={[styles.pickerLabel, { color: colors.muted }]}>Hour</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {HOURS.map((hour) => (
                    <Pressable
                      key={`hour-${hour}`}
                      accessibilityRole="button"
                      onPress={() => setDraft({ ...picked, hour })}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: hour === picked.hour ? colors.forest : colors.surfaceAlt,
                          borderColor: hour === picked.hour ? colors.forest : colors.ring,
                        },
                      ]}
                    >
                      <Text style={{ color: hour === picked.hour ? '#FFFFFF' : colors.ink, fontSize: 12, fontWeight: '700' }}>
                        {hour.toString().padStart(2, '0')}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={[styles.pickerLabel, { color: colors.muted }]}>Minute</Text>
                <View style={styles.chips}>
                  {MINUTES.map((minute) => (
                    <Pressable
                      key={`minute-${minute}`}
                      accessibilityRole="button"
                      onPress={() => setDraft({ ...picked, minute })}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: minute === picked.minute ? colors.forest : colors.surfaceAlt,
                          borderColor: minute === picked.minute ? colors.forest : colors.ring,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: minute === picked.minute ? '#FFFFFF' : colors.ink,
                          fontSize: 12,
                          fontWeight: '700',
                        }}
                      >
                        :{minute.toString().padStart(2, '0')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Button
                  label="Save time"
                  variant="secondary"
                  onPress={() => {
                    update.mutate({ dailyDigestTime: digestTime });
                    setTimeOpen(false);
                  }}
                />
              </View>
            ) : null}

            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg }}>
              <Text style={[styles.rowLabel, { color: colors.ink }]}>Snooze duration</Text>
              <SegmentedControl<SnoozePreset>
                options={[
                  { value: '1h', label: '1h' },
                  { value: '3h', label: '3h' },
                  { value: 'tomorrow', label: 'Tomorrow' },
                ]}
                value={data?.snoozePreset ?? '3h'}
                onChange={(preset) => update.mutate({ snoozePreset: preset })}
              />
            </View>

            <View style={{ paddingHorizontal: spacing.lg, borderTopWidth: 1, borderTopColor: colors.ring }}>
              <SwitchRow
                title="Overdue nudges"
                description="A gentle follow-up the day after a missed watering."
                value={data?.overdueNudges ?? true}
                onValueChange={(value) => update.mutate({ overdueNudges: value })}
              />
            </View>
          </Card>
        </View>

        <Text style={[styles.footer, { color: colors.muted }]}>
          Reminders arrive in your local time. Quiet hours are 10:00 PM – 7:00 AM.
        </Text>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 14, fontWeight: '700' },
  valueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pickerLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    minWidth: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  footer: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
