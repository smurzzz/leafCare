/**
 * Loads `.env` files for the plain-`tsx` scripts (seed, reminder job, tests).
 *
 * Next.js loads `.env.local` from its own directory automatically, but `tsx`
 * does not load anything, so a script run as `npm run seed` would see an empty
 * environment even with a correctly filled `apps/api/.env.local`.
 *
 * Precedence matches Next.js: `.env.local` wins, then `.env`, then the
 * monorepo-root `.env.local` so a root-level file still works.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, '..');
const repoRoot = join(apiRoot, '..', '..');

const candidates = [
  join(apiRoot, '.env.local'),
  join(apiRoot, '.env'),
  join(repoRoot, '.env.local'),
];

export const loadedEnvFiles: string[] = [];

// `process.loadEnvFile` exists on Node 20.12+/21.7+. On older runtimes the
// scripts simply rely on the ambient environment.
if (typeof process.loadEnvFile === 'function') {
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      process.loadEnvFile(file);
      loadedEnvFiles.push(file);
    } catch {
      // A malformed file should not stop the script; the missing variable will
      // surface as a clear MissingEnvironmentError instead.
    }
  }
}
