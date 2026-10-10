import { computeNextDueAt, type PlantSummary } from '@leafcare/shared';
import { randomUUID } from 'node:crypto';

import { authenticate } from '@/lib/auth';
import type { IdentificationRow, PlantRow } from '@/lib/db-types';
import { parseCreatePlant } from '@/lib/forms';
import { extensionForContentType, handle, json, preflight, requireUuid } from '@/lib/http';
import {
  createContext,
  listPlantRows,
  plantDetailExtras,
  plantHistory,
  serializePlantWithPhoto,
  serializePlants,
  unlockEligibleAchievements,
} from '@/lib/plants';
import { ensureProfile } from '@/lib/profile';
import { supabaseAdmin, uploadPhoto } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

const filterPlants = (plants: PlantSummary[], filter: string, query: string): PlantSummary[] => {
  const needle = query.trim().toLowerCase();
  return plants.filter((plant) => {
    if (filter === 'due_today' && plant.status !== 'due_today' && plant.status !== 'overdue') {
      return false;
    }
    if (filter.startsWith('location:')) {
      const kind = filter.slice('location:'.length);
      if (kind === 'custom') {
        const label = (plant.locationCustom ?? '').toLowerCase();
        if (!needle || !label.includes(needle)) return false;
      } else if (plant.locationKind !== kind) {
        return false;
      }
    }
    if (!needle) return true;
    return (
      plant.nickname.toLowerCase().includes(needle) ||
      (plant.speciesScientific ?? '').toLowerCase().includes(needle) ||
      (plant.speciesCommon ?? '').toLowerCase().includes(needle) ||
      plant.locationLabel.toLowerCase().includes(needle)
    );
  });
};

/** GET /api/plants?filter=all|due_today|location:{kind}&q= */
export const GET = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const profile = await ensureProfile(clerkUserId);
  const context = createContext(profile);

  const url = new URL(request.url);
  const filter = url.searchParams.get('filter') ?? 'all';
  const query = url.searchParams.get('q') ?? '';

  const rows = await listPlantRows(clerkUserId);
  const plants = await serializePlants(rows, context);
  const filtered =
    filter === 'all' && query.trim().length === 0
      ? plants
      : filterPlants(plants, filter, query);

  return json({ plants: filtered });
});

/** POST /api/plants — JSON or multipart (with an `image` file field). */
export const POST = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const profile = await ensureProfile(clerkUserId);
  const context = createContext(profile);
  const { input, image } = await parseCreatePlant(request);

  const plantId = randomUUID();
  const supabase = supabaseAdmin();

  // A saved identification supplies species + care defaults the client omitted.
  let identification: IdentificationRow | null = null;
  if (input.identificationId && requireUuid(input.identificationId, 'identification id')) {
    const { data } = await supabase
      .from('identifications')
      .select('*')
      .eq('id', input.identificationId)
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle<IdentificationRow>();
    identification = data ?? null;
  }

  const suggestion = Array.isArray(identification?.suggestions)
    ? (identification?.suggestions as Array<Record<string, unknown>>)[0]
    : undefined;

  let photoPath = input.photoPath ?? null;
  if (image) {
    photoPath = `${clerkUserId}/${plantId}.${extensionForContentType(image.contentType)}`;
    await uploadPhoto({ path: photoPath, bytes: image.bytes, contentType: image.contentType });
  }

  const lastWateredAt = input.lastWateredAt ? new Date(input.lastWateredAt) : null;
  const intervalDays = input.intervalDays;
  const reminderTime = input.reminderTime?.slice(0, 5) ?? '08:00';
  const nextDue = computeNextDueAt({
    lastWateredAt,
    intervalDays,
    reminderTime,
    timeZone: context.timeZone,
  });

  const { data: created, error } = await supabase
    .from('plants')
    .insert({
      id: plantId,
      clerk_user_id: clerkUserId,
      nickname: input.nickname,
      species_scientific: input.speciesScientific ?? (suggestion?.scientificName as string) ?? null,
      species_common: input.speciesCommon ?? (suggestion?.commonName as string) ?? null,
      location_kind: input.locationKind ?? null,
      location_custom: input.locationCustom ?? null,
      photo_path: photoPath,
      interval_days: intervalDays,
      recommended_interval_days:
        (suggestion?.intervalDays as number | undefined) ?? intervalDays,
      reminder_time: reminderTime,
      last_watered_at: lastWateredAt ? lastWateredAt.toISOString() : null,
      next_due_at: nextDue ? nextDue.toISOString() : null,
      notes: input.notes ?? null,
      light: input.light ?? (suggestion?.light as string) ?? null,
      difficulty: input.difficulty ?? (suggestion?.difficulty as string) ?? null,
      identify_confidence: input.confidence ?? null,
    })
    .select('*')
    .single<PlantRow>();
  if (error) throw new Error(`Failed to create plant: ${error.message}`);

  await unlockEligibleAchievements(clerkUserId);

  const summary = await serializePlantWithPhoto(created, context);

  return json(
    {
      plant: {
        ...summary,
        ...plantDetailExtras(created, context),
        history: await plantHistory(clerkUserId, created.id),
      },
    },
    { status: 201 },
  );
});
