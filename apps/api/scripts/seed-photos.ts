/**
 * Gives the demo plants a real photograph.
 *
 * The seed creates plants with `photo_path = null`, so Home, My Plants and
 * Reminders render placeholder art — the one part of the demo that visibly is
 * not live. This fills it in from a species photo on Wikipedia (Wikimedia
 * Commons), stores the bytes in our own private `plant-photos` bucket exactly
 * like a user's own upload, and records the source in the plant's notes so the
 * photographer is credited.
 *
 *   npm run seed:photos --workspace @leafcare/api -- <clerk_user_id> [--force]
 *
 * Only plants without a photo are touched unless `--force` is passed, so it is
 * safe to re-run. The images stay subject to their Commons licence: this credits
 * the source, and it is demo data rather than something to ship as product
 * artwork.
 */

import './load-env';

import type { PlantRow } from '../src/lib/db-types';
import { supabaseAdmin, uploadPhoto } from '../src/lib/supabase';

const USER_AGENT = 'LeafCare/1.0 (demo seed; https://github.com/leafcare)';
const MAX_BYTES = 4 * 1024 * 1024;
const EXTENSION_FOR: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

type WikiSummary = {
  title?: string;
  content_urls?: { desktop?: { page?: string } };
  originalimage?: { source?: string };
  thumbnail?: { source?: string };
};

const fetchSummary = async (title: string): Promise<WikiSummary | null> => {
  const slug = encodeURIComponent(title.trim().replace(/\s+/g, '_'));
  const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as WikiSummary;
  return body.originalimage?.source ?? body.thumbnail?.source ? body : null;
};

const grab = async (url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) return null;
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  if (!EXTENSION_FOR[contentType]) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) return null;
  return { bytes, contentType };
};

/** Original first, then Wikipedia's scaled copy for very large originals. */
const findImage = async (
  summary: WikiSummary,
): Promise<{ bytes: Uint8Array; contentType: string } | null> => {
  const candidates = [summary.originalimage?.source, summary.thumbnail?.source].filter(
    (value): value is string => Boolean(value),
  );
  for (const url of candidates) {
    const image = await grab(url);
    if (image) return image;
  }
  return null;
};

const main = async (): Promise<void> => {
  const clerkUserId = process.argv[2];
  const force = process.argv.includes('--force');
  if (!clerkUserId) {
    console.error(
      'Usage: npm run seed:photos --workspace @leafcare/api -- <clerk_user_id> [--force]',
    );
    process.exit(1);
  }

  const supabase = supabaseAdmin();
  const { data: plants, error } = await supabase
    .from('plants')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .returns<PlantRow[]>();
  if (error) throw new Error(error.message);
  if (!plants || plants.length === 0) {
    console.log('No plants for that user — run the seed first.');
    return;
  }

  let added = 0;

  for (const plant of plants) {
    if (plant.photo_path && !force) {
      console.log(`  skip   ${plant.nickname.padEnd(8)} already has a photo`);
      continue;
    }

    const searchTerms = [plant.species_scientific, plant.species_common].filter(
      (value): value is string => Boolean(value),
    );
    if (searchTerms.length === 0) {
      console.log(`  skip   ${plant.nickname.padEnd(8)} no species name to look up`);
      continue;
    }

    let summary: WikiSummary | null = null;
    for (const term of searchTerms) {
      summary = await fetchSummary(term);
      if (summary) break;
    }
    if (!summary) {
      console.log(`  miss   ${plant.nickname.padEnd(8)} no Wikipedia article for ${searchTerms.join(' / ')}`);
      continue;
    }

    const image = await findImage(summary);
    if (!image) {
      console.log(`  miss   ${plant.nickname.padEnd(8)} article has no usable JPEG/PNG`);
      continue;
    }

    const extension = EXTENSION_FOR[image.contentType]!;
    const path = `${clerkUserId}/${plant.id}.${extension}`;
    await uploadPhoto({ path, bytes: image.bytes, contentType: image.contentType });

    const pageUrl = summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${summary.title ?? ''}`;
    const credit = `Photo: ${pageUrl} (Wikimedia Commons)`;
    const notes = plant.notes?.includes('Photo:')
      ? plant.notes
      : [plant.notes?.trim(), credit].filter(Boolean).join('\n\n');

    const { error: updateError } = await supabase
      .from('plants')
      .update({ photo_path: path, notes, updated_at: new Date().toISOString() })
      .eq('id', plant.id);
    if (updateError) throw new Error(updateError.message);

    added += 1;
    console.log(
      `  photo  ${plant.nickname.padEnd(8)} ${(image.bytes.byteLength / 1024).toFixed(0)}KB ${image.contentType} · ${summary.title}`,
    );
  }

  console.log(`\n${added} photo(s) added.\n`);
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
