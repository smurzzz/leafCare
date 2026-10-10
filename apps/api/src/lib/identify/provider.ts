/**
 * Plant identification providers. Vendor keys live only here — the Expo app
 * posts the photo to /api/identify (docs/security.md).
 *
 * `mock` is the default when no vendor key is configured so the whole capture →
 * identify → add-plant flow is testable offline. It hashes the image bytes, so
 * the same photo always resolves to the same species, and it produces scores on
 * both sides of the 0.80 threshold so the low-confidence screen is reachable.
 */

import {
  DEFAULT_SPECIES_CARE,
  SPECIES_CARE_FALLBACKS,
  confidenceTier,
  findSpeciesCare,
  type ConfidenceTier,
} from '@leafcare/shared';

import { env } from '../env';
import { HttpError } from '../http';

export type RawSuggestion = {
  scientificName: string;
  commonName: string;
  score: number;
};

export type IdentifyProviderResult = {
  provider: string;
  suggestions: RawSuggestion[];
  raw: unknown;
};

export type IdentifyInput = {
  base64: string;
  contentType: string;
  filename: string;
  signal?: AbortSignal;
};

const clampScore = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value > 1) return Math.min(1, value / 100);
  return Math.max(0, value);
};

const confidenceLabel = (score: number): ConfidenceTier => confidenceTier(score);

/** Deterministic 32-bit hash used by the mock provider. */
const hashBytes = (bytes: Uint8Array): number => {
  let hash = 2166136261;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index] ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
};

const mockIdentify = (bytes: Uint8Array): IdentifyProviderResult => {
  const hash = hashBytes(bytes);
  const topIndex = hash % SPECIES_CARE_FALLBACKS.length;
  const spread = hash % 30; // 0–29 → 0.62–0.99, crossing the 0.80 threshold
  const topScore = Math.min(0.99, 0.62 + spread / 100);
  const alternatives = [1, 2, 3].map((offset) => {
    const index = (topIndex + offset) % SPECIES_CARE_FALLBACKS.length;
    return { index, score: Math.max(0.12, topScore - offset * 0.13) };
  });

  const suggestions = [topIndex, ...alternatives.map((entry) => entry.index)].map(
    (index, position) => {
      const species = SPECIES_CARE_FALLBACKS[index] ?? SPECIES_CARE_FALLBACKS[0]!;
      const score = position === 0 ? topScore : (alternatives[position - 1]?.score ?? 0.2);
      return {
        scientificName: species.scientificName,
        commonName: species.commonName,
        score: Math.round(score * 100) / 100,
      };
    },
  );

  return {
    provider: 'mock',
    suggestions,
    raw: { provider: 'mock', hash, tier: confidenceLabel(topScore) },
  };
};

type PlantIdSuggestion = {
  id?: string;
  name?: string;
  probability?: number;
  details?: {
    common_names?: string[] | null;
    taxonomy?: { genus?: string; family?: string } | null;
  };
};

const plantIdIdentify = async (input: IdentifyInput): Promise<IdentifyProviderResult> => {
  const apiKey = env.plantIdApiKey;
  if (!apiKey) throw new HttpError(503, 'CONFIG_ERROR', 'PLANT_ID_API_KEY is not configured');

  const response = await fetch(env.plantIdApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Api-Key': apiKey },
    body: JSON.stringify({
      images: [`data:${input.contentType};base64,${input.base64}`],
      classification_level: 'species',
      similar_images: false,
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new HttpError(
      response.status === 429 ? 429 : 502,
      response.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_ERROR',
      `Plant.id rejected the request (${response.status})`,
      detail.slice(0, 400),
    );
  }

  const payload = (await response.json()) as {
    result?: { classification?: { suggestions?: PlantIdSuggestion[] } };
  };
  const suggestions = (payload.result?.classification?.suggestions ?? [])
    .slice(0, 4)
    .map((suggestion) => ({
      scientificName: suggestion.name ?? 'Unknown species',
      commonName: suggestion.details?.common_names?.[0] ?? suggestion.name ?? 'Unknown species',
      score: clampScore(suggestion.probability ?? 0),
    }))
    .filter((suggestion) => suggestion.score > 0);

  return { provider: 'plant.id', suggestions, raw: payload };
};

type PlantNetResult = {
  score?: number;
  species?: { scientificNameWithoutAuthor?: string; commonNames?: string[] | null };
};

const plantNetIdentify = async (input: IdentifyInput): Promise<IdentifyProviderResult> => {
  const apiKey = env.plantNetApiKey;
  if (!apiKey) throw new HttpError(503, 'CONFIG_ERROR', 'PLANTNET_API_KEY is not configured');

  const form = new FormData();
  form.append('images', new Blob([input.base64 ? Buffer.from(input.base64, 'base64') : new Uint8Array()], { type: input.contentType }), input.filename);
  form.append('organs', 'leaf');

  const response = await fetch(`${env.plantNetApiUrl}?api-key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    body: form,
    signal: input.signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new HttpError(502, 'UPSTREAM_ERROR', `Pl@ntNet rejected the request (${response.status})`, detail.slice(0, 400));
  }

  const payload = (await response.json()) as { results?: PlantNetResult[] };
  const suggestions = (payload.results ?? []).slice(0, 4).map((entry) => ({
    scientificName: entry.species?.scientificNameWithoutAuthor ?? 'Unknown species',
    commonName: entry.species?.commonNames?.[0] ?? entry.species?.scientificNameWithoutAuthor ?? 'Unknown species',
    score: clampScore(entry.score ?? 0),
  }));

  return { provider: 'plantnet', suggestions, raw: payload };
};

export const identifyPlant = async (input: IdentifyInput): Promise<IdentifyProviderResult> => {
  const provider = env.identifyProvider;
  if (provider === 'plant_id') return plantIdIdentify(input);
  if (provider === 'plantnet') return plantNetIdentify(input);
  return mockIdentify(input.base64 ? Buffer.from(input.base64, 'base64') : new Uint8Array());
};

export type EnrichedSuggestion = {
  scientificName: string;
  commonName: string;
  score: number;
  intervalDays: number;
  light: string;
  difficulty: string;
  careDetail: string;
};

/**
 * Fills in care defaults. Plant.id's classification payload does not carry
 * watering intervals, so we prefer our curated table and fall back to the
 * documented defaults (7 days / Bright indirect / Easy) from docs/api.md.
 */
export const enrichSuggestion = (suggestion: RawSuggestion): EnrichedSuggestion => {
  const curated = findSpeciesCare(suggestion.scientificName);
  return {
    scientificName: suggestion.scientificName,
    commonName: suggestion.commonName || curated?.commonName || suggestion.scientificName,
    score: suggestion.score,
    intervalDays: curated?.intervalDays ?? DEFAULT_SPECIES_CARE.intervalDays,
    light: curated?.light ?? DEFAULT_SPECIES_CARE.light,
    difficulty: curated?.difficulty ?? DEFAULT_SPECIES_CARE.difficulty,
    careDetail: curated?.careNotes ?? DEFAULT_SPECIES_CARE.careNotes,
  };
};
