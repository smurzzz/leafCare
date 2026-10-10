/**
 * Expo push delivery (Phase 3).
 *
 * Quiet hours are honoured in the sender, and each notification is keyed by
 * plant + due date in `reminder_log` so a retried job cannot double-send
 * (docs/troubleshooting.md "Duplicate reminders").
 */

import {
  addDaysToDateKey,
  localDateKey,
  parseTimeOfDay,
  partsInTimeZone,
  zonedTimeToUtc,
} from '@leafcare/shared';

import type { NotificationPrefsRow } from './db-types';
import { env } from './env';
import { supabaseAdmin } from './supabase';

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export const sendPushMessages = async (messages: PushMessage[]): Promise<void> => {
  if (messages.length === 0) return;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.expoAccessToken) headers.Authorization = `Bearer ${env.expoAccessToken}`;

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Expo push failed (${response.status}): ${detail.slice(0, 200)}`);
  }
};

/** Minutes since local midnight, used for quiet-hours comparisons. */
const minutesOfDay = (date: Date, timeZone: string): number => {
  const parts = partsInTimeZone(date, timeZone);
  return parts.hour * 60 + parts.minute;
};

const toMinutes = (value: string): number => {
  const { hour, minute } = parseTimeOfDay(value);
  return hour * 60 + minute;
};

export const isWithinQuietHours = (options: {
  now: Date;
  timeZone: string;
  quietStart: string;
  quietEnd: string;
}): boolean => {
  const { now, timeZone, quietStart, quietEnd } = options;
  const current = minutesOfDay(now, timeZone);
  const start = toMinutes(quietStart);
  const end = toMinutes(quietEnd);
  if (start === end) return false;
  // Quiet window usually wraps midnight (22:00 → 07:00).
  if (start > end) return current >= start || current < end;
  return current >= start && current < end;
};

/** Shifts a send time out of quiet hours to the end of the window. */
export const adjustForQuietHours = (options: {
  at: Date;
  timeZone: string;
  quietStart: string;
  quietEnd: string;
}): Date => {
  const { at, timeZone, quietStart, quietEnd } = options;
  if (!isWithinQuietHours({ now: at, timeZone, quietStart, quietEnd })) return at;

  const { hour, minute } = parseTimeOfDay(quietEnd);
  const currentKey = localDateKey(at, timeZone);
  const currentMinutes = minutesOfDay(at, timeZone);
  const endMinutes = hour * 60 + minute;
  const dayOffset = currentMinutes >= endMinutes && toMinutes(quietStart) > endMinutes ? 1 : 0;
  const targetKey = dayOffset === 1 ? addDaysToDateKey(currentKey, 1) : currentKey;
  const [year, month, day] = targetKey.split('-').map((value) => Number.parseInt(value, 10));
  return zonedTimeToUtc(year!, month!, day!, hour, minute, timeZone);
};

export const shouldNotify = (prefs: NotificationPrefsRow): boolean =>
  prefs.watering_reminders && Boolean(prefs.expo_push_token);

/** Idempotency guard: records the send key, returning false if already sent. */
export const claimReminder = async (options: {
  clerkUserId: string;
  plantId: string;
  dueDate: string;
  kind: 'due' | 'digest' | 'overdue';
}): Promise<boolean> => {
  const { error } = await supabaseAdmin().from('reminder_log').insert({
    clerk_user_id: options.clerkUserId,
    plant_id: options.plantId,
    due_date: options.dueDate,
    kind: options.kind,
    sent_at: new Date().toISOString(),
  });
  if (!error) return true;
  if (error.code === '23505' || error.message.includes('duplicate')) return false;
  throw new Error(`Failed to claim reminder: ${error.message}`);
};
