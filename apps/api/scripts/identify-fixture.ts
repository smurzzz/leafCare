/**
 * Runs the configured identify provider against a real image file.
 *
 * The unit test only covers the deterministic mock, so this is the only way to
 * confirm a vendor key actually works before demo day:
 *
 *   npm run identify:fixture --workspace @leafcare/api -- path/to/leaf.jpg
 *
 * It prints the provider, the top suggestion and the high/low tier the score
 * would land in, which is exactly what screens 11 and 12 branch on.
 */

import './load-env';

import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';

import { HIGH_CONFIDENCE_THRESHOLD } from '@leafcare/shared';

import { env } from '../src/lib/env';
import { enrichSuggestion, identifyPlant } from '../src/lib/identify/provider';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

const main = async (): Promise<void> => {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: npm run identify:fixture --workspace @leafcare/api -- <image path>');
    process.exit(1);
  }

  const extension = extname(path).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    console.error(`Unsupported extension "${extension}" — expected .jpg, .png or .heic`);
    process.exit(1);
  }

  const bytes = readFileSync(path);
  console.log(`provider  : ${env.identifyProvider}`);
  console.log(`image     : ${basename(path)} (${contentType}, ${bytes.length} bytes)`);

  const startedAt = Date.now();
  const result = await identifyPlant({
    base64: bytes.toString('base64'),
    contentType,
    filename: basename(path),
  });
  const elapsed = Date.now() - startedAt;

  console.log(`round trip: ${elapsed} ms`);
  console.log(`suggestions: ${result.suggestions.length}`);

  for (const suggestion of result.suggestions.slice(0, 3)) {
    const enriched = enrichSuggestion(suggestion);
    const tier = suggestion.score >= HIGH_CONFIDENCE_THRESHOLD ? 'high' : 'low';
    console.log(
      `  ${(suggestion.score * 100).toFixed(1).padStart(5)}%  ${tier.padEnd(4)}  ` +
        `${suggestion.scientificName} (${suggestion.commonName}) · ` +
        `${enriched.intervalDays}d · ${enriched.light} · ${enriched.difficulty}`,
    );
  }

  if (result.suggestions.length === 0) {
    console.log('  (no suggestions — the vendor accepted the key but matched nothing)');
  }

  console.log(
    result.suggestions.length > 0
      ? '\nVendor path works end to end.'
      : '\nVendor responded, but with no match. Try a clearer photo of a single leaf.',
  );
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  const details = (error as { details?: unknown }).details;
  if (details) console.error('upstream said:', typeof details === 'string' ? details : JSON.stringify(details));
  process.exit(1);
});
