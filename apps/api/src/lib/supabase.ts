/**
 * Supabase service-role access.
 *
 * Per docs/database.md the API is the only writer: it verifies the Clerk session
 * and then filters every query by `clerk_user_id`. The service role key never
 * reaches the Expo app, and RLS is still enabled so a leaked anon key is inert.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from './env';

let cached: SupabaseClient | null = null;

export const supabaseAdmin = (): SupabaseClient => {
  if (cached) return cached;
  cached = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'leafcare-api' } },
  });
  return cached;
};

export const photoBucket = (): string => env.photoBucket;

/** Signed, short-lived read URL for a stored plant photo. */
export const signedPhotoUrl = async (path: string | null | undefined): Promise<string | null> => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabaseAdmin()
    .storage.from(photoBucket())
    .createSignedUrl(path, 60 * 60);
  if (error) {
    console.warn('[storage] failed to sign photo', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
};

export const uploadPhoto = async (options: {
  path: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<string> => {
  const { path, bytes, contentType } = options;
  const { error } = await supabaseAdmin()
    .storage.from(photoBucket())
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return path;
};

export const removePhoto = async (path: string | null | undefined): Promise<void> => {
  if (!path) return;
  await supabaseAdmin().storage.from(photoBucket()).remove([path]);
};

/** Deletes everything under a folder (used by account deletion). */
export const removeFolder = async (prefix: string): Promise<void> => {
  const bucket = supabaseAdmin().storage.from(photoBucket());
  const { data, error } = await bucket.list(prefix, { limit: 1000 });
  if (error || !data?.length) return;
  await bucket.remove(data.map((entry) => `${prefix}/${entry.name}`));
};
