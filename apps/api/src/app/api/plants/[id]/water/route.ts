import { waterPlantSchema } from '@leafcare/shared';

import { authenticate } from '@/lib/auth';
import { handle, json, preflight, readJson, requireUuid } from '@/lib/http';
import { createContext, serializePlantWithPhoto, waterPlant } from '@/lib/plants';
import { ensureProfile } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

/**
 * POST /api/plants/:id/water
 *
 * Called optimistically from Home, Detail and Reminders. Returns the toast copy
 * plus the refreshed plant so the client can reconcile its cache.
 */
export const POST = handle(async (request, { params }) => {
  const { clerkUserId } = await authenticate(request);
  const { id } = await params;
  const plantId = requireUuid(id, 'plant id');
  const body = await readJson(request, (value) => waterPlantSchema.parse(value ?? {}));
  const profile = await ensureProfile(clerkUserId);
  const context = createContext(profile);

  const result = await waterPlant({
    clerkUserId,
    plantId,
    context,
    amountMl: body.amountMl,
    source: body.source,
    occurredAt: body.occurredAt,
  });

  return json({
    message: `${result.plant.nickname} watered`,
    plant: await serializePlantWithPhoto(result.plant, context),
    streakDays: result.streakDays,
  });
});
