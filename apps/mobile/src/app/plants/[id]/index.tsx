/**
 * 15 — Plant detail. Full-bleed photo, next-watering ring, mark as watered,
 * stats row and the Care / History / Notes tabs (16 opens as a sheet).
 */

import { formatVolume, spacing, type PlantDetail } from '@leafcare/shared';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeftIcon, DropletIcon } from '@/components/icons';
import { ErrorState } from '@/components/ui/feedback';
import { TextField } from '@/components/ui/inputs';
import { ProgressRing, Sheet, StatBlock, Tabs, TipCard } from '@/components/ui/misc';
import { Button, Card, IconButton, SectionLabel, TextButton } from '@/components/ui/primitives';

/** Care card on the detail Care tab (Light / Water / Difficulty). */
const CareCard = ({ title, value, detail }: { title: string; value: string; detail: string }) => {
  const { colors } = useSettings();
  return (
    <Card style={{ gap: 6 }}>
      <SectionLabel>{title}</SectionLabel>
      <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{detail}</Text>
    </Card>
  );
};
import { amountLabel, deviceTimeZone, formatIsoStamp, streakWeeksLabel } from '@/lib/format';
import { useDeletePlant, usePlant, useUpdatePlant, useWaterPlant } from '@/lib/queries';
import { EditScheduleSheet } from '@/screens/edit-schedule-sheet';
import { useSettings } from '@/theme/settings-provider';

type Tab = 'care' | 'history' | 'notes';

export default function PlantDetailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id ?? '';
  const { colors, units } = useSettings();

  const plantQuery = usePlant(id);
  const water = useWaterPlant();
  const update = useUpdatePlant();
  const remove = useDeletePlant();

  const [tab, setTab] = useState<Tab>('care');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);

  const plant: PlantDetail | undefined = plantQuery.data?.plant;
  const timeZone = deviceTimeZone();

  if (plantQuery.isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ height: 260, borderRadius: 22, backgroundColor: colors.surfaceAlt }} />
          <View style={{ height: 96, borderRadius: 22, backgroundColor: colors.surfaceAlt }} />
          <View style={{ height: 64, borderRadius: 18, backgroundColor: colors.surfaceAlt }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!plant) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ErrorState
          title="We could not open this plant"
          body="It may have been deleted. Head back to My Plants and try another one."
          onRetry={() => router.replace('/(tabs)/plants')}
        />
      </SafeAreaView>
    );
  }

  const totalDays = Math.max(1, plant.intervalDays);
  const remaining = plant.status === 'overdue' ? 0 : plant.dueInDays;
  const ringValue = plant.status === 'overdue' ? 1 : 1 - remaining / totalDays;
  const ringCaption =
    plant.status === 'overdue'
      ? `${plant.overdueDays}d late`
      : plant.status === 'due_today'
        ? 'Today'
        : `${plant.dueInDays}d`;

  const notesValue = notes ?? plant.notes ?? '';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl * 2 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image
            source={plant.photoUrl ? { uri: plant.photoUrl } : undefined}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
          <SafeAreaView edges={['top']} style={styles.heroChrome}>
            <IconButton accessibilityLabel="Go back" onPress={() => router.back()} variant="glass">
              <ChevronLeftIcon size={18} color="#FFFFFF" />
            </IconButton>
            <IconButton accessibilityLabel="More options" onPress={() => setOverflowOpen(true)} variant="glass">
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', lineHeight: 20 }}>···</Text>
            </IconButton>
          </SafeAreaView>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <Text style={[styles.name, { color: colors.ink }]}>{plant.nickname}</Text>
          <Text style={[styles.species, { color: colors.muted }]}>
            {plant.speciesScientific ?? plant.speciesCommon ?? 'Houseplant'}
          </Text>
          <View style={[styles.locationChip, { backgroundColor: colors.mint }]}>
            <Text style={{ color: colors.forest, fontSize: 12, fontWeight: '700' }}>
              {plant.locationLabel}
            </Text>
          </View>

          <Card style={styles.nextCard}>
            <ProgressRing value={ringValue} size={78} thickness={9} caption={ringCaption}>
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.ringValue, { color: colors.ink }]}>{ringCaption}</Text>
              </View>
            </ProgressRing>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.nextTitle, { color: colors.ink }]}>{plant.nextWateringLabel}</Text>
              {plant.scheduledForLabel ? (
                <Text style={[styles.nextBody, { color: colors.muted }]}>
                  Scheduled for {plant.scheduledForLabel}
                </Text>
              ) : null}
              <TextButton
                label={`Every ${plant.intervalDays} days`}
                onPress={() => setScheduleOpen(true)}
              />
            </View>
          </Card>

          <Button
            label="Mark as watered"
            icon={<DropletIcon size={17} color="#FFFFFF" />}
            loading={water.isPending}
            onPress={() =>
              water.mutate({ plantId: plant.id, nickname: plant.nickname, source: 'detail' })
            }
          />

          <Card style={styles.statsRow}>
            <StatBlock
              value={
                plant.lastWateredAt
                  ? formatIsoStamp(plant.lastWateredAt, timeZone).split(' · ')[0] ?? '—'
                  : '—'
              }
              label="Last watered"
            />
            <View style={[styles.statDivider, { backgroundColor: colors.ring }]} />
            <StatBlock value={`${plant.intervalDays} days`} label="Every" />
            <View style={[styles.statDivider, { backgroundColor: colors.ring }]} />
            <StatBlock value={streakWeeksLabel(plant.streakWeeks)} label="Streak" />
          </Card>

          <Tabs<Tab>
            options={[
              { value: 'care', label: 'Care' },
              { value: 'history', label: 'History' },
              { value: 'notes', label: 'Notes' },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'care' ? (
            <View style={{ gap: spacing.md }}>
              {plant.careCards.map((card) => (
                <CareCard key={card.title} title={card.title} value={card.value} detail={card.detail} />
              ))}
              <TipCard
                title="Photo promise"
                body="Photos stay on your device unless you choose to save them."
              />
            </View>
          ) : null}

          {tab === 'history' ? (
            <View style={{ gap: spacing.md }}>
              {plant.history.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  No care logged yet. Mark it watered and it will show up here.
                </Text>
              ) : (
                plant.history.map((event) => (
                  <View
                    key={event.id}
                    style={[styles.historyRow, { borderBottomColor: colors.ring }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>
                        {event.type === 'watered'
                          ? amountLabel(event.amountMl, units)
                          : event.type === 'snoozed'
                            ? 'Snoozed reminder'
                            : 'Missed watering'}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                        {formatIsoStamp(event.occurredAt, timeZone)}
                        {event.source ? ` · from ${event.source}` : ''}
                      </Text>
                    </View>
                    {event.amountMl ? (
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        {formatVolume(event.amountMl, units)}
                      </Text>
                    ) : null}
                  </View>
                ))
              )}
              <TextButton
                label="Open full care log"
                onPress={() => router.push({ pathname: '/care-log', params: { plantId: plant.id } })}
              />
            </View>
          ) : null}

          {tab === 'notes' ? (
            <View style={{ gap: spacing.md }}>
              <TextField
                label="Notes"
                value={notesValue}
                onChangeText={setNotes}
                placeholder="Repotted in spring, moved away from the radiator…"
                autoCapitalize="sentences"
              />
              <Button
                label="Save notes"
                variant="secondary"
                loading={update.isPending}
                onPress={() => {
                  update.mutate({ id: plant.id, patch: { notes: notesValue } });
                  setNotes(null);
                }}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <EditScheduleSheet
        visible={scheduleOpen}
        plant={plant}
        onClose={() => setScheduleOpen(false)}
        onDeleted={() => router.replace('/(tabs)/plants')}
      />

      <Sheet visible={overflowOpen} onClose={() => setOverflowOpen(false)} title="Plant options">
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setOverflowOpen(false);
            setScheduleOpen(true);
          }}
          style={[styles.menuRow, { borderBottomColor: colors.ring }]}
        >
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}>Edit schedule</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setOverflowOpen(false);
            Alert.alert(
              'Change photo',
              'Use the scan camera to capture a new photo, then save it from the add-plant screen.',
              [
                { text: 'Scan a leaf', onPress: () => router.push('/scan') },
                { text: 'Cancel', style: 'cancel' },
              ],
            );
          }}
          style={[styles.menuRow, { borderBottomColor: colors.ring }]}
        >
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}>Change photo</Text>
        </Pressable>

        <SectionLabel>Danger zone</SectionLabel>
        <Button
          label="Delete plant"
          variant="danger"
          loading={remove.isPending}
          onPress={() => {
            remove.mutate(
              { id: plant.id, nickname: plant.nickname },
              { onSuccess: () => router.replace('/(tabs)/plants') },
            );
            setOverflowOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { height: 320, backgroundColor: '#D8E5DC' },
  heroChrome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  sheet: {
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    gap: spacing.md,
  },
  name: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  species: { fontSize: 14, fontStyle: 'italic', marginTop: -spacing.sm },
  locationChip: { alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: 999 },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ringValue: { fontSize: 15, fontWeight: '800' },
  nextTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  nextBody: { fontSize: 12, lineHeight: 17 },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.lg },
  statDivider: { width: 1, height: 34 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  menuRow: { paddingVertical: spacing.lg, borderBottomWidth: 1 },
});
