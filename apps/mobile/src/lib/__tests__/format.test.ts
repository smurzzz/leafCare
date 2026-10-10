/**
 * Presentation helpers (src/lib/format.ts).
 *
 * These strings appear verbatim in the PNGs — `Mar 14 · 8:05 AM`, `Due today`,
 * `in 3 days`, `Watered · 250 ml` — so they are pinned here rather than eyeballed
 * on a device. Timezone-sensitive cases use Asia/Manila (UTC+8, no DST) so the
 * expectations cannot drift with the machine's clock settings.
 */

import {
  FALLBACK_TIME_ZONE,
  amountLabel,
  calendarCells,
  dateKeyFor,
  daysInMonth,
  deviceTimeZone,
  formatIsoDate,
  formatIsoStamp,
  formatIsoTime,
  formatMediumDate,
  formatReminderTime,
  monthKeyFromDate,
  monthKeyShift,
  streakWeeksLabel,
  todayDateKey,
} from '../format';

const MANILA = 'Asia/Manila';

describe('formatIsoTime / formatIsoDate / formatIsoStamp', () => {
  // 00:05 UTC is 08:05 the same morning in Manila.
  const iso = '2026-03-08T00:05:00.000Z';

  it('renders a 12-hour clock time in the given zone', () => {
    expect(formatIsoTime(iso, MANILA)).toBe('8:05 AM');
  });

  it('renders short month and day', () => {
    expect(formatIsoDate(iso, MANILA)).toBe('Mar 8');
  });

  it('joins date and time with a middle dot for the care log', () => {
    expect(formatIsoStamp(iso, MANILA)).toBe('Mar 8 · 8:05 AM');
  });

  it('crosses the date line when the zone says so', () => {
    // 16:30 UTC on the 8th is 00:30 on the 9th in Manila: the care log must show
    // the user's day, not UTC's.
    expect(formatIsoDate('2026-03-08T16:30:00.000Z', MANILA)).toBe('Mar 9');
  });
});

describe('formatMediumDate', () => {
  it('renders `Mar 8, 2026` for the LAST WATERED field', () => {
    expect(formatMediumDate(new Date('2026-03-08T04:00:00.000Z'), MANILA)).toBe('Mar 8, 2026');
  });
});

describe('formatReminderTime', () => {
  it('renders a stored HH:MM as a 12-hour label', () => {
    expect(formatReminderTime('08:15')).toBe('8:15 AM');
    expect(formatReminderTime('19:30')).toBe('7:30 PM');
  });
});

describe('amountLabel', () => {
  it('says `Watered` alone when no amount was recorded', () => {
    expect(amountLabel(null, 'metric')).toBe('Watered');
  });

  it('appends the volume in the selected unit system', () => {
    expect(amountLabel(250, 'metric')).toBe('Watered · 250 ml');
    expect(amountLabel(250, 'imperial')).toBe('Watered · 8.5 oz');
    expect(amountLabel(1000, 'metric')).toBe('Watered · 1000 ml');
  });

  it('rounds the metric value instead of printing a fraction', () => {
    expect(amountLabel(249.6, 'metric')).toBe('Watered · 250 ml');
  });
});

describe('month maths', () => {
  it('shifts months across a year boundary in both directions', () => {
    expect(monthKeyShift('2026-03', 0)).toBe('2026-03');
    expect(monthKeyShift('2026-01', -1)).toBe('2025-12');
    expect(monthKeyShift('2026-12', 1)).toBe('2027-01');
    expect(monthKeyShift('2026-03', -3)).toBe('2025-12');
  });

  it('counts days per month, including leap February', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-04')).toBe(30);
    expect(daysInMonth('2026-12')).toBe(31);
  });
});

describe('calendarCells', () => {
  it('pads to the first weekday and covers the whole month', () => {
    // 1 March 2026 is a Sunday, so the grid starts on day 1.
    const march = calendarCells('2026-03');
    expect(march).toHaveLength(31);
    expect(march[0]).toBe(1);
    expect(march).not.toContain(null);

    // 1 February 2026 is a Sunday too; 1 April 2026 is a Wednesday (3 blanks).
    const april = calendarCells('2026-04');
    expect(april.slice(0, 3)).toEqual([null, null, null]);
    expect(april[3]).toBe(1);
    expect(april).toHaveLength(33);
  });
});

describe('date keys', () => {
  it('builds a zero-padded day key for the care log', () => {
    expect(dateKeyFor('2026-03', 5)).toBe('2026-03-05');
    expect(dateKeyFor('2026-03', 25)).toBe('2026-03-25');
  });

  it('derives today from the zone, not from UTC', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-08T16:30:00.000Z'));
    try {
      expect(todayDateKey(MANILA)).toBe('2026-03-09');
      expect(todayDateKey('UTC')).toBe('2026-03-08');
      expect(monthKeyFromDate(new Date('2026-03-08T16:30:00.000Z'), MANILA)).toBe('2026-03');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('streakWeeksLabel', () => {
  it('singularises one week', () => {
    expect(streakWeeksLabel(1)).toBe('1 wk');
    expect(streakWeeksLabel(7)).toBe('7 wks');
    expect(streakWeeksLabel(0)).toBe('0 wks');
  });
});

describe('deviceTimeZone', () => {
  it('never returns an empty zone', () => {
    expect(typeof deviceTimeZone()).toBe('string');
    expect(deviceTimeZone().length).toBeGreaterThan(0);
    expect(FALLBACK_TIME_ZONE).toBe('Asia/Manila');
  });
});
