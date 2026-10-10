/**
 * 16 — Edit schedule sheet. Large stepper, reset to recommended, reminder time
 * picker, save and the coral delete-plant action.
 */

import { formatClockTime, spacing, type PlantDetail } from '@leafcare/shared';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ClockIcon, CloseIcon } from '@/components/icons';
import { Stepper } from '@/components/ui/inputs';
import { Sheet } from '@/components/ui/misc';
import { Button, IconButton, TextButton } from '@/components/ui/primitives';
import { useDeletePlant, useResetSchedule, useUpdatePlant } from '@/lib/queries';
import { useSettings } from '@/theme/settings-provider';

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = [0, 15, 30, 45];

export const EditScheduleSheet = ({
  visible,
  plant,
  onClose,
  onDeleted,
}: {
  visible: boolean;
  plant: PlantDetail;
  onClose: () => void;
  onDeleted: () => void;
}) => {
  const { colors } = useSettings();
  const update = useUpdatePlant();
  const reset = useResetSchedule();
  const remove = useDeletePlant();

  const [intervalDays, setIntervalDays] = useState(plant.intervalDays);
  const [hour, setHour] = useState(Number(plant.reminderTime.slice(0, 2)) || 8);
  const [minute, setMinute] = useState(Number(plant.reminderTime.slice(3, 5)) || 0);
  const [timeOpen, setTimeOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setIntervalDays(plant.intervalDays);
    setHour(Number(plant.reminderTime.slice(0, 2)) || 8);
    setMinute(Number(plant.reminderTime.slice(3, 5)) || 0);
    setConfirmDelete(false);
  }, [visible, plant.intervalDays, plant.reminderTime]);

  const reminderTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const recommended = plant.recommendedIntervalDays ?? plant.intervalDays;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.ink }]}>Watering schedule</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {plant.nickname} · {plant.speciesCommon ?? plant.speciesScientific ?? 'Houseplant'}
          </Text>
        </View>
        <IconButton accessibilityLabel="Close" onPress={onClose} size={36} variant="mint">
          <CloseIcon size={15} color={colors.forest} />
        </IconButton>
      </View>

      <Stepper value={intervalDays} onChange={setIntervalDays} min={1} max={60} suffix="days" size="lg" />

      <TextButton
        label={`Reset to recommended (${recommended} days)`}
        tone="muted"
        onPress={() => {
          setIntervalDays(recommended);
          reset.mutate(plant.id);
        }}
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => setTimeOpen((value) => !value)}
        style={[styles.row, { borderBottomColor: colors.ring }]}
      >
        <View style={styles.rowLabel}>
          <ClockIcon size={16} color={colors.forest} />
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>Reminder time</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>
          {formatClockTime(reminderTime)}
        </Text>
      </Pressable>

      {timeOpen ? (
        <View style={{ gap: spacing.md }}>
          <Text style={[styles.pickerLabel, { color: colors.muted }]}>Hour</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeRow}>
            {HOURS.map((value) => (
              <Pressable
                key={`hour-${value}`}
                accessibilityRole="button"
                onPress={() => setHour(value)}
                style={[
                  styles.timeChip,
                  {
                    backgroundColor: value === hour ? colors.forest : colors.surfaceAlt,
                    borderColor: value === hour ? colors.forest : colors.ring,
                  },
                ]}
              >
                <Text
                  style={{
                    color: value === hour ? '#FFFFFF' : colors.ink,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {value.toString().padStart(2, '0')}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={[styles.pickerLabel, { color: colors.muted }]}>Minute</Text>
          <View style={styles.timeRow}>
            {MINUTES.map((value) => (
              <Pressable
                key={`minute-${value}`}
                accessibilityRole="button"
                onPress={() => setMinute(value)}
                style={[
                  styles.timeChip,
                  {
                    backgroundColor: value === minute ? colors.forest : colors.surfaceAlt,
                    borderColor: value === minute ? colors.forest : colors.ring,
                  },
                ]}
              >
                <Text
                  style={{
                    color: value === minute ? '#FFFFFF' : colors.ink,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  :{value.toString().padStart(2, '0')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Button
        label="Save"
        loading={update.isPending}
        onPress={() => {
          update.mutate({ id: plant.id, patch: { intervalDays, reminderTime } });
          onClose();
        }}
      />

      {confirmDelete ? (
        <View style={[styles.confirm, { backgroundColor: colors.coralSoft }]}>
          <Text style={{ color: colors.coralDeep, fontSize: 13, fontWeight: '700' }}>
            Delete {plant.nickname}? Care history is removed too.
          </Text>
          <View style={styles.confirmRow}>
            <Button label="Cancel" variant="secondary" size="sm" onPress={() => setConfirmDelete(false)} />
            <Button
              label="Delete"
              variant="danger"
              size="sm"
              loading={remove.isPending}
              onPress={() => {
                remove.mutate(
                  { id: plant.id, nickname: plant.nickname },
                  {
                    onSuccess: () => {
                      onClose();
                      onDeleted();
                    },
                  },
                );
              }}
            />
          </View>
        </View>
      ) : (
        <TextButton label="Delete plant" tone="coral" onPress={() => setConfirmDelete(true)} />
      )}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 12, marginTop: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
  },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pickerLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  timeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  timeChip: {
    minWidth: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  confirm: { borderRadius: 16, padding: spacing.lg, gap: spacing.md },
  confirmRow: { flexDirection: 'row', gap: spacing.md },
});
