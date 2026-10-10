import { snoozePresetSchema } from '@leafcare/shared';
import { z } from 'zod';

import { authenticate } from '@/lib/auth';
import { handle, json, preflight, readJson, requireUuid } from '@/lib/http';
import { createContext, requirePlant, serializePlantWithPhoto } from '@/lib/plants';
import { ensureProfile } from '@/lib/profile';
import { snoozeUntil } from '@/lib/reminders';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

const bodySchema = z.object({ preset: snoozePresetSchema.optional() });

/**
 * POST /api/reminders/:plantId/snooze
 * Moves the notification only — the watering schedule is untouched.
 */
export const POST = handle(async (request, { params }) => {
  const { clerkUserId } = await authenticate(request);
  const { plantId: rawPlantId } = await params;
  const plantId = requireUuid(rawPlantId, 'plant id');
  const plant = await requirePlant(clerkUserId, plantId);
  const profile = await ensureProfile(clerkUserId);
  const context = createContext(profile);
  const body = await readJson(request, (value) => bodySchema.parse(value ?? {}));

  const preset = body.preset ?? '3h';
  const until = snoozeUntil({
    preset,
    now: context.now,
    reminderTime: plant.reminder_time,
    timeZone: context.timeZone,
  });

  const supabase = supabaseAdmin();
  await supabase.from('care_events').insert({
    plant_id: plant.id,
    clerk_user_id: clerkUserId,
    type: 'snoozed',
    occurred_at: context.now.toISOString(),
    source: 'reminders',
  });

  const { data: updated, error } = await supabase
    .from('plants')
    .update({ snoozed_until: until.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', plantId)
    .eq('clerk_user_id', clerkUserId)
    .select('*')
    .single<typeof plant>();
  if (error) throw new Error(`Failed to snooze reminder: ${error.message}`);

  return json({
    snoozedUntil: until.toISOString(),
    preset,
    plant: await serializePlantWithPhoto(updated, context),
  });
});
