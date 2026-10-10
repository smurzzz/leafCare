import { confidenceTier } from '@leafcare/shared';
import { randomUUID } from 'node:crypto';

import { authenticate } from '@/lib/auth';
import type { IdentificationRow } from '@/lib/db-types';
import { env } from '@/lib/env';
import { HttpError, badRequest, handle, isUuid, json, preflight, readImageUpload } from '@/lib/http';
import { enrichSuggestion, identifyPlant } from '@/lib/identify/provider';
import { createContext } from '@/lib/plants';
import { ensureProfile, profileTimeZone } from '@/lib/profile';
import { rateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const OPTIONS = (request: Request) => preflight(request);

/**
 * POST /api/identify — multipart/form-data with an `image` field.
 *
 * The photo is sent to the provider and then dropped: docs/specification.md
 * promises photos stay on device until the user saves the plant. Only the
 * provider's JSON is persisted, in `identifications`.
 */
export const POST = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);

  const limit = rateLimit({
    key: `identify:${clerkUserId}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    throw new HttpError(
      429,
      'RATE_LIMITED',
      'You have identified a lot of plants in the last hour. Try again shortly.',
      { retryAfterSeconds: limit.retryAfterSeconds },
    );
  }

  const profile = await ensureProfile(clerkUserId);
  const context = createContext(profile);
  void profileTimeZone(profile);

  const upload = await readImageUpload(request);
  const requestedId = request.headers.get('x-request-id');
  const identificationId = requestedId && isUuid(requestedId) ? requestedId : randomUUID();

  const supabase = supabaseAdmin();
  await supabase.from('identifications').upsert(
    {
      id: identificationId,
      clerk_user_id: clerkUserId,
      status: 'pending',
      provider: env.identifyProvider,
    },
    { onConflict: 'id' },
  );

  try {
    const result = await identifyPlant({
      base64: upload.base64,
      contentType: upload.contentType,
      filename: upload.filename,
      signal: request.signal,
    });

    const enriched = result.suggestions
      .map((suggestion) => enrichSuggestion(suggestion))
      .sort((a, b) => b.score - a.score);

    if (enriched.length === 0) {
      await supabase
        .from('identifications')
        .update({ status: 'failed', raw_response: result.raw as never })
        .eq('id', identificationId);
      throw new HttpError(422, 'UPSTREAM_ERROR', 'No species matched this photo');
    }

    const [top, ...rest] = enriched;
    if (!top) throw badRequest('No suggestions returned');

    const { data: saved } = await supabase
      .from('identifications')
      .update({
        status: 'succeeded',
        provider: result.provider,
        raw_response: result.raw as never,
        suggestions: enriched as never,
      })
      .eq('id', identificationId)
      .select('*')
      .single<IdentificationRow>();
    void saved;

    return json({
      identificationId,
      threshold: confidenceTier(top.score),
      // The client already holds the captured photo locally.
      photoUrl: null,
      top,
      alternatives: rest,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      await supabase
        .from('identifications')
        .update({ status: error.status === 499 ? 'cancelled' : 'failed' })
        .eq('id', identificationId);
    }
    throw error;
  }
});
