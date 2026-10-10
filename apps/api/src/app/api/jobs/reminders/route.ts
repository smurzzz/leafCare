import { formatClockTime, localDateKey, type SnoozePreset } from '@leafcare/shared';

import { assertCronSecret } from '@/lib/auth';
import type { NotificationPrefsRow, PlantRow, ProfileRow } from '@/lib/db-types';
import { handle, json, preflight } from '@/lib/http';
import { computePlantNextDue } from '@/lib/plants';
import { adjustForQuietHours, claimReminder, sendPushMessages, shouldNotify } from '@/lib/push';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const OPTIONS = (request: Request) => preflight(request);

type UserBundle = { profile: ProfileRow; prefs: NotificationPrefsRow };

const snoozeLabel = (preset: SnoozePreset): string =>
  preset === '1h' ? '1 hour' : preset === '3h' ? '3 hours' : 'tomorrow';

/**
 * POST /api/jobs/reminders — run by a scheduler (Vercel cron, GitHub Action or
 * Supabase scheduled function) every 15 minutes.
 *
 * For each opted-in user it sends one push per plant that is due now, plus the
 * daily digest at the user's chosen time. Sends are de-duplicated by
 * `reminder_log (plant_id, due_date, kind)`.
 */
export const POST = handle(async (request) => {
  assertCronSecret(request);
  const supabase = supabaseAdmin();
  const now = new Date();

  const { data: prefs, error } = await supabase
    .from('notification_prefs')
    .select('*')
    .not('expo_push_token', 'is', null)
    .returns<NotificationPrefsRow[]>();
  if (error) throw new Error(`Failed to read notification prefs: ${error.message}`);

  const active: NotificationPrefsRow[] = (prefs ?? []).filter(shouldNotify);
  if (active.length === 0) return json({ ok: true, sent: 0, users: 0 });

  const userIds = active.map((entry) => entry.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds)
    .returns<ProfileRow[]>();
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const bundles: UserBundle[] = active.flatMap((entry) => {
    const profile = profileById.get(entry.user_id);
    return profile ? [{ profile, prefs: entry }] : [];
  });
  if (bundles.length === 0) return json({ ok: true, sent: 0, users: 0 });

  const { data: plants } = await supabase
    .from('plants')
    .select('*')
    .in(
      'clerk_user_id',
      bundles.map((bundle) => bundle.profile.clerk_user_id),
    )
    .returns<PlantRow[]>();

  const plantsByUser = new Map<string, PlantRow[]>();
  for (const plant of plants ?? []) {
    const list = plantsByUser.get(plant.clerk_user_id) ?? [];
    list.push(plant);
    plantsByUser.set(plant.clerk_user_id, list);
  }

  let sent = 0;

  for (const { profile, prefs: userPrefs } of bundles) {
    const timeZone = profile.timezone || 'Asia/Manila';
    const todayKey = localDateKey(now, timeZone);
    const userPlants = plantsByUser.get(profile.clerk_user_id) ?? [];
    const digestTime = `${userPrefs.daily_digest_time.slice(0, 5)}`;
    const localNow = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    for (const plant of userPlants) {
      const due = computePlantNextDue(plant, timeZone);
      if (!due) continue;
      const dueKey = localDateKey(due, timeZone);
      const overdue = dueKey < todayKey;
      const dueNow = dueKey <= todayKey;
      if (!dueNow) continue;
      if (overdue && !userPrefs.overdue_nudges) continue;

      // A due notification is sent once per plant per due date, at (or after)
      // the plant's reminder time, unless it was snoozed.
      const snoozedUntil = plant.snoozed_until ? new Date(plant.snoozed_until) : null;
      if (snoozedUntil && snoozedUntil.getTime() > now.getTime()) continue;
      if (due.getTime() > now.getTime()) continue;

      const kind = overdue ? 'overdue' : 'due';
      const claimed = await claimReminder({
        clerkUserId: profile.clerk_user_id,
        plantId: plant.id,
        dueDate: dueKey,
        kind,
      });
      if (!claimed) continue;

      const sendAt = adjustForQuietHours({
        at: now,
        timeZone,
        quietStart: userPrefs.quiet_start.slice(0, 5),
        quietEnd: userPrefs.quiet_end.slice(0, 5),
      });

      const bodyParts = [
        overdue
          ? `${plant.nickname} is overdue — water it to get back on track.`
          : `Scheduled for ${formatClockTime(plant.reminder_time)}.`,
        `Snooze: ${snoozeLabel(userPrefs.snooze_preset)}.`,
      ];

      const delayMs = Math.max(0, sendAt.getTime() - now.getTime());
      const message = {
        to: userPrefs.expo_push_token!,
        title: `Water ${plant.nickname}`,
        body: bodyParts.join(' '),
        data: { plantId: plant.id, kind },
      };

      if (delayMs > 60_000) {
        // Quiet hours: keep the claim, deliver when the window closes.
        setTimeout(() => {
          void sendPushMessages([message]).catch((error) =>
            console.warn('[jobs] delayed push failed', error),
          );
        }, delayMs);
        sent += 1;
        continue;
      }

      await sendPushMessages([message]);
      sent += 1;
    }

    // Daily digest: plants due today, sent at the user's chosen time.
    const digestDue = userPlants.filter((plant) => {
      const due = computePlantNextDue(plant, timeZone);
      return due ? localDateKey(due, timeZone) === todayKey : false;
    });
    if (digestDue.length > 0 && localNow >= digestTime) {
      const claimed = await claimReminder({
        clerkUserId: profile.clerk_user_id,
        plantId: digestDue[0]!.id,
        dueDate: todayKey,
        kind: 'digest',
      });
      if (claimed) {
        await sendPushMessages([
          {
            to: userPrefs.expo_push_token!,
            title: `${digestDue.length} plant${digestDue.length === 1 ? '' : 's'} need water today`,
            body: digestDue.map((plant) => plant.nickname).join(', '),
            data: { kind: 'digest' },
          },
        ]);
        sent += 1;
      }
    }
  }

  return json({ ok: true, sent, users: bundles.length });
});
