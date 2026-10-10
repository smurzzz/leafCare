-- Profile photos (screen 21).
--
-- Separate from `plant-photos` on purpose: plant photos stay private and are read
-- through short-lived signed URLs, while an avatar is shown in the app's own
-- header and must keep working with no signing round-trip — so it is a public
-- bucket. Objects are keyed by `{clerk_user_id}/avatar-{timestamp}.{ext}`, which
-- leaks nothing but a photo the user chose to upload.
--
-- Public read does not make the bucket writable from the client: the API holds the
-- service role, and the anon key that ships in the app still has no write policy.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may *read* an avatar (that is what `public: true` means), but writes stay
-- with the service role that only the API can use.
drop policy if exists "avatars readable by anyone" on storage.objects;
create policy "avatars readable by anyone"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');
