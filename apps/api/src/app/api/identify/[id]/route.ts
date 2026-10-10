import { authenticate } from '@/lib/auth';
import { handle, preflight, requireUuid, json } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

/**
 * DELETE /api/identify/:id — Cancel on the identifying sheet (screen 10).
 * Marks the row cancelled and drops any temp photo that was stored.
 */
export const DELETE = handle(async (request, { params }) => {
  const { clerkUserId } = await authenticate(request);
  const { id } = await params;
  const identificationId = requireUuid(id, 'identification id');

  const supabase = supabaseAdmin();
  const { data: existing } = await supabase
    .from('identifications')
    .select('id, photo_path')
    .eq('id', identificationId)
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle<{ id: string; photo_path: string | null }>();

  if (existing?.photo_path) {
    await supabase.storage.from('plant-photos').remove([existing.photo_path]);
  }

  await supabase
    .from('identifications')
    .update({ status: 'cancelled', photo_path: null })
    .eq('id', identificationId)
    .eq('clerk_user_id', clerkUserId);

  return json({ ok: true });
});
