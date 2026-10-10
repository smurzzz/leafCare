import type { PlantRow } from '@/lib/db-types';
import { authenticate } from '@/lib/auth';
import { handle, json, preflight, requireUuid } from '@/lib/http';
import {
  createContext,
  plantDetailExtras,
  plantHistory,
  refreshSchedule,
  requirePlant,
  serializePlantWithPhoto,
} from '@/lib/plants';
import { ensureProfile } from '@/lib/profile';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

/** POST /api/plants/:id/schedule/reset — restores the species default interval. */
export const POST = handle(async (request, { params }) => {
  const { clerkUserId } = await authenticate(request);
  const { id } = await params;
  const plantId = requireUuid(id, 'plant id');
  const plant = await requirePlant(clerkUserId, plantId);
  const profile = await ensureProfile(clerkUserId);
  const context = createContext(profile);

  const recommended = plant.recommended_interval_days ?? plant.interval_days;

  const { data: updated, error } = await supabaseAdmin()
    .from('plants')
    .update({
      interval_days: recommended,
      updated_at: new Date().toISOString(),
    })
    .eq('id', plantId)
    .eq('clerk_user_id', clerkUserId)
    .select('*')
    .single<PlantRow>();
  if (error) throw new Error(`Failed to reset schedule: ${error.message}`);

  const refreshed = await refreshSchedule(updated, context.timeZone);

  return json({
    plant: {
      ...(await serializePlantWithPhoto(refreshed, context)),
      ...plantDetailExtras(refreshed, context),
      history: await plantHistory(clerkUserId, refreshed.id),
    },
  });
});
