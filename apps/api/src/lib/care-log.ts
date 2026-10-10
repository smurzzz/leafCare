/**
 * Care log (screen 17): per-day calendar state, month summary and recent feed.
 *
 * A day is `watered` when a watered event exists, `missed` when a scheduled due
 * date passed without a watering, otherwise `empty`.
 */

import { daysBetweenDateKeys, localDateKey, type CareLogResponse } from '@leafcare/shared';

import type { CareEventRow, PlantRow } from './db-types';
import { computePlantNextDue, listPlantRows, type RequestContext } from './plants';
import { signedPhotoUrl, supabaseAdmin } from './supabase';

const MONTH_LABELS = [
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

export const currentMonthKey = (now: Date, timeZone: string): string =>
  localDateKey(now, timeZone).slice(0, 7);

export const isValidMonthKey = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export const monthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map((value) => Number.parseInt(value, 10));
  return `${MONTH_LABELS[(month ?? 1) - 1]} ${year}`;
};

const previousMonthKey = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map((value) => Number.parseInt(value, 10));
  const date = new Date(Date.UTC(year!, (month ?? 1) - 2, 1));
  return date.toISOString().slice(0, 7);
};

const daysInMonth = (monthKey: string): number => {
  const [year, month] = monthKey.split('-').map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year!, month!, 0)).getUTCDate();
};

const monthBounds = (monthKey: string): { start: string; end: string } => {
  const total = daysInMonth(monthKey);
  return { start: `${monthKey}-01`, end: `${monthKey}-${String(total).padStart(2, '0')}` };
};

/**
 * Walks each plant's schedule across the month to find due dates that were not
 * honoured. Bounded by the month so the payload stays small.
 */
const missedDaysForMonth = (
  plants: PlantRow[],
  monthKey: string,
  wateredKeys: Set<string>,
  todayKey: string,
): Set<string> => {
  const missed = new Set<string>();
  const { start, end } = monthBounds(monthKey);

  for (const plant of plants) {
    const interval = Math.max(1, plant.interval_days);
    // Anchor the walk on the plant's next due date so we stay aligned with the
    // real schedule rather than guessing from the month start.
    const nextDue = computePlantNextDue(plant, 'UTC');
    if (!nextDue) continue;
    let cursor = localDateKey(nextDue, 'UTC');
    // Step backwards into the month, then forwards across it.
    while (daysBetweenDateKeys(cursor, start) > 0) {
      const previous = new Date(`${cursor}T00:00:00.000Z`);
      previous.setUTCDate(previous.getUTCDate() - interval);
      cursor = previous.toISOString().slice(0, 10);
    }
    while (daysBetweenDateKeys(cursor, end) <= 0) {
      const inPast = daysBetweenDateKeys(cursor, todayKey) > 0;
      if (inPast && cursor >= start && !wateredKeys.has(cursor)) {
        // Give each due date a one-day grace window before calling it missed.
        const grace = new Date(`${cursor}T00:00:00.000Z`);
        grace.setUTCDate(grace.getUTCDate() + 1);
        if (!wateredKeys.has(grace.toISOString().slice(0, 10))) missed.add(cursor);
      }
      const next = new Date(`${cursor}T00:00:00.000Z`);
      next.setUTCDate(next.getUTCDate() + interval);
      cursor = next.toISOString().slice(0, 10);
    }
  }
  return missed;
};

export const buildCareLogPayload = async (options: {
  context: RequestContext;
  month?: string;
  plantId?: string;
}): Promise<CareLogResponse> => {
  const { context } = options;
  const month = options.month && isValidMonthKey(options.month) ? options.month : currentMonthKey(context.now, context.timeZone);
  const todayKey = localDateKey(context.now, context.timeZone);
  const supabase = supabaseAdmin();

  const rows = await listPlantRows(context.profile.clerk_user_id);
  const plants = options.plantId ? rows.filter((row) => row.id === options.plantId) : rows;

  const { start, end } = monthBounds(month);
  const { data: monthEvents, error } = await supabase
    .from('care_events')
    .select('*')
    .eq('clerk_user_id', context.profile.clerk_user_id)
    .eq('type', 'watered')
    .gte('occurred_at', `${start}T00:00:00.000Z`)
    .lte('occurred_at', `${end}T23:59:59.999Z`)
    .order('occurred_at', { ascending: false })
    .returns<CareEventRow[]>();
  if (error) throw new Error(`Failed to read care log: ${error.message}`);

  const recentFiltered = options.plantId
    ? (monthEvents ?? []).filter((event) => event.plant_id === options.plantId)
    : (monthEvents ?? []);
  const wateredKeys = new Set(
    recentFiltered.map((event) => localDateKey(new Date(event.occurred_at), context.timeZone)),
  );

  const prevMonth = previousMonthKey(month);
  const prevBounds = monthBounds(prevMonth);
  const { count: previousCount } = await supabase
    .from('care_events')
    .select('id', { count: 'exact', head: true })
    .eq('clerk_user_id', context.profile.clerk_user_id)
    .eq('type', 'watered')
    .gte('occurred_at', `${prevBounds.start}T00:00:00.000Z`)
    .lte('occurred_at', `${prevBounds.end}T23:59:59.999Z`);

  const missed = missedDaysForMonth(plants, month, wateredKeys, todayKey);

  const days: Record<string, 'watered' | 'missed' | 'empty'> = {};
  for (let day = 1; day <= daysInMonth(month); day += 1) {
    const key = `${month}-${String(day).padStart(2, '0')}`;
    if (wateredKeys.has(key)) days[key] = 'watered';
    else if (missed.has(key)) days[key] = 'missed';
    else days[key] = 'empty';
  }

  const plantById = new Map(rows.map((row) => [row.id, row]));
  const { data: recentEvents } = await supabase
    .from('care_events')
    .select('*')
    .eq('clerk_user_id', context.profile.clerk_user_id)
    .order('occurred_at', { ascending: false })
    .limit(options.plantId ? 60 : 30)
    .returns<CareEventRow[]>();
  const visibleRecent = options.plantId
    ? (recentEvents ?? []).filter((event) => event.plant_id === options.plantId)
    : (recentEvents ?? []);

  const recent = await Promise.all(
    visibleRecent.slice(0, 30).map(async (event) => {
      const plant = plantById.get(event.plant_id);
      return {
        id: event.id,
        type: event.type,
        amountMl: event.amount_ml,
        plantId: event.plant_id,
        plantNickname: plant?.nickname ?? 'Plant',
        occurredAt: event.occurred_at,
        photoUrl: await signedPhotoUrl(plant?.photo_path),
      };
    }),
  );

  return {
    month,
    monthLabel: monthLabel(month),
    days,
    wateringsThisMonth: recentFiltered.length,
    deltaVsPrevMonth: recentFiltered.length - (previousCount ?? 0),
    missedDays: missed.size,
    recent,
  };
};
