/**
 * Timezone-aware date helpers shared by the API and the Expo app.
 *
 * The product spec stores schedules as "last watered + interval days, at the
 * plant's reminder time, in the user's timezone". Everything below is
 * dependency-free so it runs on Node, Hermes and in tests.
 */

export const FALLBACK_TIME_ZONE = 'Asia/Manila';

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

const partsFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = partsFormatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  partsFormatterCache.set(timeZone, formatter);
  return formatter;
};

/** Splits an instant into wall-clock parts as seen in `timeZone`. */
export const partsInTimeZone = (date: Date, timeZone: string): ZonedParts => {
  const formatter = partsFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value ?? '0';
    return Number.parseInt(value, 10);
  };
  return {
    year: read('year'),
    // Intl renders midnight as hour 24 in some engines; normalise it back to 0.
    hour: read('hour') % 24,
    month: read('month'),
    day: read('day'),
    minute: read('minute'),
    second: read('second'),
  };
};

/** Milliseconds that `timeZone` is ahead of UTC at the given instant. */
export const timeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const parts = partsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
};

/**
 * Builds an instant from wall-clock parts in `timeZone`.
 * Two passes resolve DST boundaries where the offset itself depends on the result.
 */
export const zonedTimeToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date => {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstOffset = timeZoneOffsetMs(new Date(guess), timeZone);
  const first = guess - firstOffset;
  const secondOffset = timeZoneOffsetMs(new Date(first), timeZone);
  return new Date(guess - secondOffset);
};

/** `2026-03-14` for the given instant, evaluated in `timeZone`. */
export const localDateKey = (date: Date, timeZone: string): string => {
  const parts = partsInTimeZone(date, timeZone);
  return `${parts.year.toString().padStart(4, '0')}-${parts.month
    .toString()
    .padStart(2, '0')}-${parts.day.toString().padStart(2, '0')}`;
};

/** Parses `2026-03-14` into integer parts (no timezone attached). */
export const parseDateKey = (key: string): { year: number; month: number; day: number } => {
  const [year, month, day] = key.split('-').map((chunk) => Number.parseInt(chunk, 10));
  return { year, month, day };
};

/** Parses `08:00` / `08:00:00` into `{ hour, minute }`. */
export const parseTimeOfDay = (value: string): { hour: number; minute: number } => {
  const [hour = '0', minute = '0'] = value.split(':');
  return {
    hour: Number.parseInt(hour, 10),
    minute: Number.parseInt(minute, 10),
  };
};

/** `HH:MM` (24h) — the storage format used by the API. */
export const toTimeOfDay = (hour: number, minute: number): string =>
  `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

/** Adds whole days to a `YYYY-MM-DD` key using UTC-safe arithmetic. */
export const addDaysToDateKey = (key: string, days: number): string => {
  const { year, month, day } = parseDateKey(key);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};

/** Whole-day difference between two date keys (`b - a`). */
export const daysBetweenDateKeys = (a: string, b: string): number => {
  const from = parseDateKey(a);
  const to = parseDateKey(b);
  const fromMs = Date.UTC(from.year, from.month - 1, from.day);
  const toMs = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toMs - fromMs) / 86_400_000);
};

/**
 * The next watering instant for a plant: last watered date + interval days at
 * the plant's reminder time in the user's timezone.
 */
export const computeNextDueAt = (options: {
  lastWateredAt: Date | string | null | undefined;
  intervalDays: number;
  reminderTime: string;
  timeZone: string;
}): Date | null => {
  const { lastWateredAt, intervalDays, reminderTime, timeZone } = options;
  if (!lastWateredAt) return null;
  const last = typeof lastWateredAt === 'string' ? new Date(lastWateredAt) : lastWateredAt;
  if (Number.isNaN(last.getTime())) return null;

  const lastKey = localDateKey(last, timeZone);
  const dueKey = addDaysToDateKey(lastKey, Math.max(1, Math.round(intervalDays)));
  const { year, month, day } = parseDateKey(dueKey);
  const { hour, minute } = parseTimeOfDay(reminderTime);
  return zonedTimeToUtc(year, month, day, hour, minute, timeZone);
};

/** `Mar 8, 2026` style label used by the add-plant form and settings rows. */
export const formatMediumDate = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

/** `8:00 AM` style label used by schedule rows. */
export const formatClockTime = (value: string): string => {
  const { hour, minute } = parseTimeOfDay(value);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${suffix}`;
};

/** `Thursday, Mar 16` style label used on the plant detail card. */
export const formatWeekdayDate = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date);

/** `Tuesday, 14 March` overline used on Home. */
export const formatHomeOverline = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(date)
    .toUpperCase();

export const greetingForDate = (date: Date, timeZone: string): string => {
  const { hour } = partsInTimeZone(date, timeZone);
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

/** `0:12` countdown used by the OTP resend timer. */
export const formatCountdown = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
};
