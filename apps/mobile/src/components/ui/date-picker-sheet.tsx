/**
 * Minimal month calendar used by the add-plant "LAST WATERED" field and the
 * care-log day filter. Dependency-free so the app has one calendar that matches
 * the design instead of a platform picker.
 */

import { spacing } from '@leafcare/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { calendarCells, dateKeyFor, monthKeyFromDate, todayDateKey } from '@/lib/format';
import { useSettings } from '@/theme/settings-provider';

import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import { Sheet } from './misc';
import { Button, IconButton } from './primitives';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const monthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map((value) => Number.parseInt(value, 10));
  return `${MONTHS[(month ?? 1) - 1]} ${year}`;
};

const shiftMonth = (monthKey: string, delta: number): string => {
  const [year, month] = monthKey.split('-').map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + delta, 1)).toISOString().slice(0, 7);
};

export const CalendarGrid = ({
  timeZone,
  selectedKey,
  onSelect,
  /** Highest month the user may navigate to (defaults to the current month). */
  maxMonthKey,
  dayState,
}: {
  timeZone: string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  maxMonthKey?: string;
  dayState?: (key: string) => 'watered' | 'missed' | 'empty';
}) => {
  const { colors } = useSettings();
  const todayKey = todayDateKey(timeZone);
  const [monthKey, setMonthKey] = useState(selectedKey?.slice(0, 7) ?? monthKeyFromDate(new Date(), timeZone));
  const limit = maxMonthKey ?? monthKeyFromDate(new Date(), timeZone);
  const cells = calendarCells(monthKey);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Previous month" onPress={() => setMonthKey(shiftMonth(monthKey, -1))} size={36} variant="mint">
          <ChevronLeftIcon size={16} color={colors.forest} />
        </IconButton>
        <Text style={[styles.monthLabel, { color: colors.ink }]}>{monthLabel(monthKey)}</Text>
        <IconButton
          accessibilityLabel="Next month"
          onPress={() => setMonthKey(shiftMonth(monthKey, 1))}
          size={36}
          variant="mint"
          style={{ opacity: monthKey >= limit ? 0.4 : 1 }}
        >
          <ChevronRightIcon size={16} color={colors.forest} />
        </IconButton>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAYS.map((day, index) => (
          <Text key={`${day}-${index}`} style={[styles.weekday, { color: colors.muted }]}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (day === null) return <View key={`blank-${index}`} style={styles.cell} />;
          const key = dateKeyFor(monthKey, day);
          const state = dayState?.(key) ?? 'empty';
          const selected = key === selectedKey;
          const isToday = key === todayKey;
          const dotColor =
            state === 'watered' ? colors.forest : state === 'missed' ? colors.coral : colors.ring;

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${monthLabel(monthKey)} ${day}`}
              onPress={() => onSelect(key)}
              style={[
                styles.cell,
                selected && { backgroundColor: colors.forest, borderRadius: 12 },
                !selected && isToday && { borderWidth: 1, borderColor: colors.forest, borderRadius: 12 },
              ]}
            >
              <Text
                style={{
                  color: selected ? '#FFFFFF' : colors.ink,
                  fontSize: 12,
                  fontWeight: selected || isToday ? '800' : '500',
                }}
              >
                {day}
              </Text>
              <View style={[styles.dot, { backgroundColor: selected ? '#FFFFFF' : dotColor }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export const DatePickerSheet = ({
  visible,
  onClose,
  value,
  onChange,
  timeZone,
}: {
  visible: boolean;
  onClose: () => void;
  value: string;
  onChange: (key: string) => void;
  timeZone: string;
}) => {
  const [draft, setDraft] = useState(value);
  return (
    <Sheet visible={visible} onClose={onClose} title="Last watered">
      <CalendarGrid timeZone={timeZone} selectedKey={draft} onSelect={setDraft} />
      <Button
        label="Use this date"
        onPress={() => {
          onChange(draft);
          onClose();
        }}
      />
    </Sheet>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthLabel: { fontSize: 15, fontWeight: '800' },
  weekdays: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
