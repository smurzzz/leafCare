import { verifyWebhook } from '@clerk/nextjs/webhooks';

import { identityFromClerkUser, type ClerkUserLike } from '@/lib/identity';
import { wipeUserData } from '@/lib/me';
import { ensureProfile } from '@/lib/profile';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/clerk — signature verified by Clerk's own verifier.
 *
 * `user.created` upserts a profile + default notification prefs;
 * `user.deleted` cascades a wipe if the client-side delete did not finish.
 */
export const POST = async (request: Request) => {
  // Clerk's verifier reads CLERK_WEBHOOK_SIGNING_SECRET; accept the shorter
  // name documented in .env.example too.
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET && process.env.CLERK_WEBHOOK_SECRET) {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  }

  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(request as Parameters<typeof verifyWebhook>[0]);
  } catch (error) {
    console.error('[clerk-webhook] verification failed', error);
    return new Response('Verification failed', { status: 400 });
  }

  try {
    if (event.type === 'user.created' || event.type === 'user.updated') {
      // Same mapping the API uses, so the webhook and `GET /api/me` cannot drift.
      const data = event.data as unknown as ClerkUserLike;
      await ensureProfile(event.data.id, identityFromClerkUser(data));
    }

    if (event.type === 'user.deleted') {
      const clerkUserId = event.data.id;
      if (clerkUserId) {
        const { data: profile } = await supabaseAdmin()
          .from('profiles')
          .select('id')
          .eq('clerk_user_id', clerkUserId)
          .maybeSingle<{ id: string }>();
        if (profile) await wipeUserData(clerkUserId, profile.id);
      }
    }
  } catch (error) {
    console.error('[clerk-webhook] handler failed', error);
    return new Response('Handler failed', { status: 500 });
  }

  return Response.json({ ok: true });
};
