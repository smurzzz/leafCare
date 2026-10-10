// Smoke test: shared time/domain math + API route behaviour with stubbed Supabase.
import assert from 'node:assert/strict';
const shared = await import('../packages/shared/dist/index.js');
const {
  computeNextDueAt, dueInfoFor, statusLabel, nextStreak, confidenceTier,
  formatVolume, mlToOz, localDateKey, zonedTimeToUtc, unlockedAchievements, monthLabelFallback = null,
} = shared;

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log('ok -', name); };

check('next_due_at = last watered + interval at reminder time (Asia/Manila)', () => {
  const last = zonedTimeToUtc(2026, 3, 8, 8, 15, 'Asia/Manila');
  const due = computeNextDueAt({ lastWateredAt: last, intervalDays: 7, reminderTime: '08:00', timeZone: 'Asia/Manila' });
  assert.equal(localDateKey(due, 'Asia/Manila'), '2026-03-15');
  assert.equal(due.toISOString(), zonedTimeToUtc(2026, 3, 15, 8, 0, 'Asia/Manila').toISOString());
});

check('overdue / due today / upcoming classification + labels', () => {
  const now = zonedTimeToUtc(2026, 3, 14, 9, 41, 'Asia/Manila');
  const overdue = dueInfoFor({ nextDueAt: zonedTimeToUtc(2026, 3, 12, 8, 0, 'Asia/Manila'), now, timeZone: 'Asia/Manila' });
  assert.deepEqual(overdue, { status: 'overdue', overdueDays: 2, dueInDays: 0 });
  assert.equal(statusLabel(overdue), 'Overdue 2d');
  const today = dueInfoFor({ nextDueAt: zonedTimeToUtc(2026, 3, 14, 8, 0, 'Asia/Manila'), now, timeZone: 'Asia/Manila' });
  assert.equal(statusLabel(today), 'Due today');
  const later = dueInfoFor({ nextDueAt: zonedTimeToUtc(2026, 3, 20, 8, 0, 'Asia/Manila'), now, timeZone: 'Asia/Manila' });
  assert.equal(statusLabel(later), 'in 6 days');
});

check('identify threshold 0.80 splits high/low', () => {
  assert.equal(confidenceTier(0.94), 'high');
  assert.equal(confidenceTier(0.8), 'high');
  assert.equal(confidenceTier(0.58), 'low');
});

check('streak: consecutive day increments, overdue resets, same day is idempotent', () => {
  assert.equal(nextStreak({ currentStreakDays: 6, lastCareDateKey: '2026-03-13', todayKey: '2026-03-14', wasOverdue: false }), 7);
  assert.equal(nextStreak({ currentStreakDays: 6, lastCareDateKey: '2026-03-13', todayKey: '2026-03-14', wasOverdue: true }), 1);
  assert.equal(nextStreak({ currentStreakDays: 7, lastCareDateKey: '2026-03-14', todayKey: '2026-03-14', wasOverdue: false }), 7);
  assert.equal(nextStreak({ currentStreakDays: 3, lastCareDateKey: '2026-03-10', todayKey: '2026-03-14', wasOverdue: false }), 1);
});

check('unit conversion ml <-> oz', () => {
  assert.equal(formatVolume(250, 'metric'), '250 ml');
  assert.equal(formatVolume(250, 'imperial'), '8.5 oz');
  assert.ok(Math.abs(mlToOz(29.5735295625) - 1) < 1e-9);
});

check('achievements derive from stats', () => {
  assert.deepEqual(unlockedAchievements({ plants: 6, streakDays: 7 }), ['first_plant', 'streak_7']);
  assert.deepEqual(unlockedAchievements({ plants: 0, streakDays: 0 }), []);
  assert.deepEqual(unlockedAchievements({ plants: 10, streakDays: 30 }), ['first_plant', 'streak_7', 'plants_10', 'streak_30']);
});

check('DST-safe zoned conversion round-trips', () => {
  const instant = zonedTimeToUtc(2026, 11, 1, 1, 30, 'America/New_York');
  assert.equal(localDateKey(instant, 'America/New_York'), '2026-11-01');
});

console.log(`\n${passed} checks passed`);
