import { confidenceTier } from '@leafcare/shared';
import { randomUUID } from 'node:crypto';

import { authenticate } from '@/lib/auth';
import { env } from '@/lib/env';
import { HttpError, badRequest, handle, isUuid, json, preflight, readImageUpload } from '@/lib/http';
import { enrichSuggestion, identifyPlant } from '@/lib/identify/provider';
import { ensureProfile } from '@/lib/profile';
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

  // Creates the profile row on the first identify; the row itself is not needed here.
  await ensureProfile(clerkUserId);

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
      // The provider answered, it simply had no match. That is the low-
      // confidence path (docs/specification.md screen 12), not an error, so the
      // call succeeds with no `top` and the app offers tips, retake and search.
      await supabase
        .from('identifications')
        .update({
          status: 'succeeded',
          provider: result.provider,
          raw_response: result.raw as never,
          suggestions: [] as never,
        })
        .eq('id', identificationId);

      return json({
        identificationId,
        threshold: confidenceTier(0),
        photoUrl: null,
        top: null,
        alternatives: [],
      });
    }

    const [top, ...rest] = enriched;
    if (!top) throw badRequest('No suggestions returned');

    await supabase
      .from('identifications')
      .update({
        status: 'succeeded',
        provider: result.provider,
        raw_response: result.raw as never,
        suggestions: enriched as never,
      })
      .eq('id', identificationId);

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
