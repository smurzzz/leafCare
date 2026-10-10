import { DEFAULT_SPECIES_CARE, SPECIES_CARE_FALLBACKS, type Species } from '@leafcare/shared';

import { authenticate } from '@/lib/auth';
import type { SpeciesRow } from '@/lib/db-types';
import { handle, json, preflight } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

const toSpecies = (name: string): Species => {
  const needle = name.trim().toLowerCase();
  const curated = SPECIES_CARE_FALLBACKS.find(
    (entry) =>
      entry.scientificName.toLowerCase() === needle ||
      entry.commonName.toLowerCase() === needle,
  );
  return {
    scientificName: curated?.scientificName ?? name,
    commonName: curated?.commonName ?? name,
    intervalDays: curated?.intervalDays ?? DEFAULT_SPECIES_CARE.intervalDays,
    light: curated?.light ?? DEFAULT_SPECIES_CARE.light,
    difficulty: curated?.difficulty ?? DEFAULT_SPECIES_CARE.difficulty,
    careDetail: curated?.careNotes ?? DEFAULT_SPECIES_CARE.careNotes,
  };
};

/**
 * GET /api/species?q= — manual fallback search on the low-confidence screen (12).
 * Merges the curated catalogue with the `species_cache` table so both seeded and
 * previously identified species are searchable, with no external scraping.
 */
export const GET = handle(async (request) => {
  await authenticate(request);
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  const needle = query.toLowerCase();

  const { data, error } = await supabaseAdmin()
    .from('species_cache')
    .select('*')
    .order('scientific_name', { ascending: true })
    .limit(200)
    .returns<SpeciesRow[]>();
  if (error) throw new Error(`Failed to read species cache: ${error.message}`);

  const fromDb = (data ?? []).flatMap((row) => [
    toSpecies(row.scientific_name),
    ...(row.common_name ? [toSpecies(row.common_name)] : []),
  ]);

  const catalogue = [...SPECIES_CARE_FALLBACKS.map((entry) => toSpecies(entry.scientificName)), ...fromDb];
  const unique = new Map(catalogue.map((entry) => [entry.scientificName, entry]));
  const results = [...unique.values()]
    .filter((entry) =>
      needle.length === 0
        ? true
        : entry.scientificName.toLowerCase().includes(needle) ||
          entry.commonName.toLowerCase().includes(needle),
    )
    .slice(0, 25);

  return json({ results });
});
