import { authenticate } from '@/lib/auth';
import { handle, json, preflight, requireUuid } from '@/lib/http';
import { createContext, serializePlantWithPhoto, waterPlant } from '@/lib/plants';
import { ensureProfile } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

/** POST /api/reminders/:plantId/done — identical semantics to marking watered. */
export const POST = handle(async (request, { params }) => {
  const { clerkUserId } = await authenticate(request);
  const { plantId: rawPlantId } = await params;
  const plantId = requireUuid(rawPlantId, 'plant id');
  const profile = await ensureProfile(clerkUserId);
  const context = createContext(profile);

  const result = await waterPlant({
    clerkUserId,
    plantId,
    context,
    source: 'reminders',
  });

  return json({
    message: `${result.plant.nickname} watered`,
    plant: await serializePlantWithPhoto(result.plant, context),
    streakDays: result.streakDays,
  });
});
