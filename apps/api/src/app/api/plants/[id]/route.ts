import { computeNextDueAt } from '@leafcare/shared';

import { authenticate } from '@/lib/auth';
import type { PlantRow } from '@/lib/db-types';
import { parseUpdatePlant } from '@/lib/forms';
import { extensionForContentType, handle, json, noContent, preflight, requireUuid } from '@/lib/http';
import {
  createContext,
  plantDetailExtras,
  plantHistory,
  refreshSchedule,
  requirePlant,
  serializePlantWithPhoto,
} from '@/lib/plants';
import { ensureProfile } from '@/lib/profile';
import { removePhoto, supabaseAdmin, uploadPhoto } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

const detailPayload = async (plant: PlantRow, clerkUserId: string, context: ReturnType<typeof createContext>) => ({
  plant: {
    ...(await serializePlantWithPhoto(plant, context)),
    ...plantDetailExtras(plant, context),
    history: await plantHistory(clerkUserId, plant.id),
  },
});

/** GET /api/plants/:id */
export const GET = handle(async (request, { params }) => {
  const { clerkUserId } = await authenticate(request);
  const { id } = await params;
  const plant = await requirePlant(clerkUserId, requireUuid(id, 'plant id'));
  const profile = await ensureProfile(clerkUserId);
  return json(await detailPayload(plant, clerkUserId, createContext(profile)));
});

/** PATCH /api/plants/:id — nickname, location, notes, photo, interval, reminder. */
export const PATCH = handle(async (request, { params }) => {
  const { clerkUserId } = await authenticate(request);
  const { id } = await params;
  const plantId = requireUuid(id, 'plant id');
  const plant = await requirePlant(clerkUserId, plantId);
  const profile = await ensureProfile(clerkUserId);
  const context = createContext(profile);
  const { input, image } = await parseUpdatePlant(request);

  let photoPath = plant.photo_path;
  if (image) {
    if (plant.photo_path) await removePhoto(plant.photo_path);
    photoPath = `${clerkUserId}/${plantId}.${extensionForContentType(image.contentType)}`;
    await uploadPhoto({ path: photoPath, bytes: image.bytes, contentType: image.contentType });
  } else if (input.photoPath !== undefined) {
    photoPath = input.photoPath;
  }

  const intervalDays = input.intervalDays ?? plant.interval_days;
  const reminderTime = input.reminderTime?.slice(0, 5) ?? plant.reminder_time;
  const lastWateredAt =
    input.lastWateredAt === undefined
      ? plant.last_watered_at
      : (input.lastWateredAt ?? null);

  const nextDue = computeNextDueAt({
    lastWateredAt,
    intervalDays,
    reminderTime,
    timeZone: context.timeZone,
  });

  const patch: Partial<PlantRow> = {
    photo_path: photoPath,
    interval_days: intervalDays,
    reminder_time: reminderTime,
    last_watered_at: lastWateredAt,
    next_due_at: nextDue ? nextDue.toISOString() : null,
  };
  if (input.nickname !== undefined) patch.nickname = input.nickname;
  if (input.speciesScientific !== undefined) patch.species_scientific = input.speciesScientific;
  if (input.speciesCommon !== undefined) patch.species_common = input.speciesCommon;
  if (input.locationKind !== undefined) patch.location_kind = input.locationKind;
  if (input.locationCustom !== undefined) patch.location_custom = input.locationCustom;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.light !== undefined) patch.light = input.light;
  if (input.difficulty !== undefined) patch.difficulty = input.difficulty;
  if (input.confidence !== undefined) patch.identify_confidence = input.confidence;

  const { data: updated, error } = await supabaseAdmin()
    .from('plants')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', plantId)
    .eq('clerk_user_id', clerkUserId)
    .select('*')
    .single<PlantRow>();
  if (error) throw new Error(`Failed to update plant: ${error.message}`);

  const refreshed = await refreshSchedule(updated, context.timeZone);
  return json(await detailPayload(refreshed, clerkUserId, context));
});

/** DELETE /api/plants/:id — care events cascade in Postgres. */
export const DELETE = handle(async (request, { params }) => {
  const { clerkUserId } = await authenticate(request);
  const { id } = await params;
  const plantId = requireUuid(id, 'plant id');
  const plant = await requirePlant(clerkUserId, plantId);

  await removePhoto(plant.photo_path);
  const { error } = await supabaseAdmin()
    .from('plants')
    .delete()
    .eq('id', plantId)
    .eq('clerk_user_id', clerkUserId);
  if (error) throw new Error(`Failed to delete plant: ${error.message}`);

  return noContent();
});
