/**
 * Reminders service (screens 18–19).
 *
 * Grouping is derived from each plant's next due instant in the user's timezone:
 * today, tomorrow, then anything within the following week.
 */

import {
  addDaysToDateKey,
  daysBetweenDateKeys,
  formatClockTime,
  localDateKey,
  parseTimeOfDay,
  zonedTimeToUtc,
  type ReminderItem,
  type RemindersResponse,
  type SnoozePreset,
} from '@leafcare/shared';

import type { CareEventRow, PlantRow } from './db-types';
import {
  computePlantNextDue,
  listPlantRows,
  serializePlants,
  type RequestContext,
} from './plants';
import { signedPhotoUrl, supabaseAdmin } from './supabase';

const SHORT_WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const shortWeekday = (date: Date, timeZone: string): string => {
  const label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return SHORT_WEEKDAY.includes(label as (typeof SHORT_WEEKDAY)[number]) ? label : label.slice(0, 3);
};

/** Groups plants into today / tomorrow / this week. */
export const buildRemindersPayload = async (
  context: RequestContext,
  tab: 'upcoming' | 'completed',
): Promise<RemindersResponse> => {
  const rows = await listPlantRows(context.profile.clerk_user_id);
  const plants = await serializePlants(rows, context);

  const todayKey = localDateKey(context.now, context.timeZone);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const weekEndKey = addDaysToDateKey(todayKey, 7);

  const groups: Array<{
    key: 'today' | 'tomorrow' | 'this_week';
    label: string;
    items: ReminderItem[];
  }> = [
    { key: 'today', label: 'Today', items: [] },
    { key: 'tomorrow', label: 'Tomorrow', items: [] },
    { key: 'this_week', label: 'This week', items: [] },
  ];

  for (const plant of plants) {
    const due = plant.nextDueAt ? new Date(plant.nextDueAt) : null;
    if (!due) continue;
    const dueKey = localDateKey(due, context.timeZone);
    const offset = daysBetweenDateKeys(todayKey, dueKey);
    if (offset > 7) continue;

    const overdue = offset < 0;
    const item: ReminderItem = {
      plantId: plant.id,
      title: `Water ${plant.nickname}`,
      nickname: plant.nickname,
      time:
        offset <= 1
          ? formatClockTime(plant.reminderTime)
          : `${shortWeekday(due, context.timeZone)} · ${formatClockTime(plant.reminderTime)}`,
      photoUrl: plant.photoUrl,
      overdue,
    };

    if (overdue || dueKey === todayKey) groups[0]!.items.push(item);
    else if (dueKey === tomorrowKey) groups[1]!.items.push(item);
    else if (daysBetweenDateKeys(todayKey, dueKey) <= (daysBetweenDateKeys(todayKey, weekEndKey) || 7))
      groups[2]!.items.push(item);
  }

  groups[0]!.items.sort((a, b) => Number(b.overdue) - Number(a.overdue));
  const populated = groups.filter((group) => group.items.length > 0);

  return {
    groups: populated,
    completed: await completedItems(context),
    empty: populated.length === 0,
  };
};

/** Waterings already logged today, newest first (the Completed segment). */
export const completedItems = async (context: RequestContext): Promise<ReminderItem[]> => {
  const startOfToday = localDateKey(context.now, context.timeZone);
  const { data, error } = await supabaseAdmin()
    .from('care_events')
    .select('*')
    .eq('clerk_user_id', context.profile.clerk_user_id)
    .eq('type', 'watered')
    .gte('occurred_at', new Date(`${startOfToday}T00:00:00.000Z`).toISOString())
    .order('occurred_at', { ascending: false })
    .limit(20)
    .returns<CareEventRow[]>();
  if (error) throw new Error(`Failed to read completed reminders: ${error.message}`);

  const events = data ?? [];
  if (events.length === 0) return [];

  const plantIds = [...new Set(events.map((event) => event.plant_id))];
  const { data: plants } = await supabaseAdmin()
    .from('plants')
    .select('*')
    .eq('clerk_user_id', context.profile.clerk_user_id)
    .in('id', plantIds)
    .returns<PlantRow[]>();
  const byId = new Map((plants ?? []).map((plant) => [plant.id, plant]));

  return Promise.all(
    events.map(async (event) => {
      const plant = byId.get(event.plant_id);
      const time = new Intl.DateTimeFormat('en-US', {
        timeZone: context.timeZone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(event.occurred_at));
      return {
        plantId: event.plant_id,
        title: `Water ${plant?.nickname ?? 'plant'}`,
        nickname: plant?.nickname ?? 'Plant',
        time: `Today · ${time}`,
        photoUrl: await signedPhotoUrl(plant?.photo_path),
        overdue: false,
      } satisfies ReminderItem;
    }),
  );
};

/** Snooze uses the preset from Notification settings (screen 20). */
export const snoozeUntil = (options: {
  preset: SnoozePreset;
  now: Date;
  reminderTime: string;
  timeZone: string;
}): Date => {
  const { preset, now, reminderTime, timeZone } = options;
  if (preset === 'tomorrow') {
    const tomorrow = addDaysToDateKey(localDateKey(now, timeZone), 1);
    const [year, month, day] = tomorrow.split('-').map((value) => Number.parseInt(value, 10));
    const { hour, minute } = parseTimeOfDay(reminderTime);
    return zonedTimeToUtc(year!, month!, day!, hour, minute, timeZone);
  }
  const hours = preset === '1h' ? 1 : 3;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
};

export const nextDueForPlant = computePlantNextDue;
