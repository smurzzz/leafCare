/**
 * Presentation helpers. All of these are pure so they can be unit tested and
 * reused by any screen.
 */

import { formatClockTime, formatVolume, type UnitSystemValue } from '@leafcare/shared';

export const FALLBACK_TIME_ZONE = 'Asia/Manila';

export const deviceTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? FALLBACK_TIME_ZONE;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
};

export const formatIsoTime = (iso: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

/** `Mar 8, 2026` — the LAST WATERED field on add plant. */
export const formatMediumDate = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

export const formatIsoDate = (iso: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));

/** `Mar 14 · 8:05 AM` — the care-log activity timestamp. */
export const formatIsoStamp = (iso: string, timeZone: string): string =>
  `${formatIsoDate(iso, timeZone)} · ${formatIsoTime(iso, timeZone)}`;

/** `8:15 AM` from a stored `HH:MM`. */
export const formatReminderTime = (time: string): string => formatClockTime(time);

export const amountLabel = (amountMl: number | null, units: UnitSystemValue): string =>
  amountMl === null ? 'Watered' : `Watered · ${formatVolume(amountMl, units)}`;

export const monthKeyShift = (monthKey: string, delta: number): string => {
  const [year, month] = monthKey.split('-').map((value) => Number.parseInt(value, 10));
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
};

export const daysInMonth = (monthKey: string): number => {
  const [year, month] = monthKey.split('-').map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate();
};

/** Leading blanks + day numbers, ready for a 7-column calendar grid. */
export const calendarCells = (monthKey: string): (number | null)[] => {
  const [year, month] = monthKey.split('-').map((value) => Number.parseInt(value, 10));
  const firstWeekday = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1)).getUTCDay();
  const total = daysInMonth(monthKey);
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: total }, (_, index) => index + 1),
  ];
};

export const dateKeyFor = (monthKey: string, day: number): string =>
  `${monthKey}-${String(day).padStart(2, '0')}`;

const zonedDateKey = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: 'year' | 'month' | 'day'): string =>
    parts.find((part) => part.type === type)?.value ?? '01';
  return `${read('year')}-${read('month')}-${read('day')}`;
};

export const monthKeyFromDate = (date: Date, timeZone: string): string =>
  zonedDateKey(date, timeZone).slice(0, 7);

export const todayDateKey = (timeZone: string): string => zonedDateKey(new Date(), timeZone);

/** `7 wks` / `1 wk` for the detail stats row. */
export const streakWeeksLabel = (weeks: number): string => `${weeks} ${weeks === 1 ? 'wk' : 'wks'}`;
