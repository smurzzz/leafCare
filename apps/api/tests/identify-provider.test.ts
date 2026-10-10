/**
 * Identify provider checks (run with `npx tsx apps/api/tests/identify-provider.test.ts`).
 *
 * With no vendor key configured the deterministic mock must still satisfy the
 * documented contract: stable output for the same bytes, descending scores, and
 * reachable results on both sides of the 0.80 confidence threshold so screens 11
 * and 12 are both exercisable without Plant.id spend.
 */

import assert from 'node:assert/strict';

import { enrichSuggestion, identifyPlant } from '../src/lib/identify/provider';

const bytesFor = (seed: number, length = 256): Uint8Array =>
  new Uint8Array(Array.from({ length }, (_, index) => (index * 31 + seed * 7) % 256));

const run = async (): Promise<void> => {
  const leaf = bytesFor(37, 512);

  const first = await identifyPlant({
    base64: Buffer.from(leaf).toString('base64'),
    contentType: 'image/jpeg',
    filename: 'leaf.jpg',
  });
  const again = await identifyPlant({
    base64: Buffer.from(leaf).toString('base64'),
    contentType: 'image/jpeg',
    filename: 'leaf.jpg',
  });

  assert.equal(first.provider, 'mock');
  assert.deepEqual(first.suggestions, again.suggestions, 'same bytes must give the same species');
  assert.ok(first.suggestions.length >= 3, 'expect several suggestions');

  const topScore = first.suggestions[0]!.score;
  assert.ok(topScore >= 0.6 && topScore <= 0.99, `top score out of range: ${topScore}`);
  for (let index = 1; index < first.suggestions.length; index += 1) {
    assert.ok(
      first.suggestions[index]!.score <= first.suggestions[index - 1]!.score,
      'scores must descend',
    );
  }

  const enriched = first.suggestions.map(enrichSuggestion);
  const top = enriched[0]!;
  assert.ok(top.intervalDays >= 1 && top.intervalDays <= 60, 'interval within 1–60 days');
  assert.ok(top.light.length > 0 && top.difficulty.length > 0 && top.careDetail.length > 0);

  const scores: number[] = [];
  for (let seed = 0; seed < 400; seed += 1) {
    const result = await identifyPlant({
      base64: Buffer.from(bytesFor(seed)).toString('base64'),
      contentType: 'image/png',
      filename: 'sample.png',
    });
    scores.push(result.suggestions[0]!.score);
  }
  const high = scores.filter((score) => score >= 0.8).length;
  const low = scores.length - high;
  assert.ok(high > 20 && low > 20, `threshold reachable both ways (high=${high}, low=${low})`);

  console.log(
    `identify provider ok · top=${top.scientificName} @ ${top.score} · high=${high} low=${low}`,
  );
};

void run();