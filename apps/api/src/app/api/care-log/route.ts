import { authenticate } from '@/lib/auth';
import { buildCareLogPayload } from '@/lib/care-log';
import { handle, json, preflight, requireUuid } from '@/lib/http';
import { createContext } from '@/lib/plants';
import { ensureProfile } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

/** GET /api/care-log?month=2026-03&plantId= */
export const GET = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const url = new URL(request.url);
  const month = url.searchParams.get('month') ?? undefined;
  const plantIdParam = url.searchParams.get('plantId');
  const profile = await ensureProfile(clerkUserId);

  return json(
    await buildCareLogPayload({
      context: createContext(profile),
      month,
      plantId: plantIdParam ? requireUuid(plantIdParam, 'plant id') : undefined,
    }),
  );
});
