/**
 * Fails when a real credential has been written into a tracked file.
 *
 * This exists because `.env.example` is tracked by design: it is the one file
 * that looks like a place to paste keys. Filling it in for real commits the
 * secret to the repository and, once pushed, to GitHub history.
 *
 * Only variable names, paths and line numbers are printed — never the value.
 *
 *   node scripts/check-secrets.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Values that are obviously placeholders, not credentials. */
const PLACEHOLDER = [
  /^$/,
  /^x+$/i,
  /^changeme$/i,
  /^change-me$/i,
  /^your[-_ ].*/i,
  /^<.*>$/,
  /^\.{3,}$/,
  /^sk_(test|live)_x+$/i,
  /^whsec_x+$/i,
  /^eyJx+$/i,
  /^https?:\/\//i,
];

const isPlaceholder = (value) => PLACEHOLDER.some((pattern) => pattern.test(value));

/** Vendor prefixes that are always a live credential. */
const VENDOR_PATTERNS = [
  { label: 'Clerk secret key', pattern: /^sk_(test|live)_[A-Za-z0-9]{20,}$/ },
  { label: 'Clerk webhook secret', pattern: /^whsec_[A-Za-z0-9]{20,}$/ },
  { label: 'Supabase secret key', pattern: /^sb_secret_[A-Za-z0-9_-]{10,}$/ },
  { label: 'Supabase management token', pattern: /^sbp_[A-Za-z0-9]{20,}$/ },
  { label: 'JWT (legacy Supabase service role)', pattern: /^eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./ },
];

/** `SOMETHING_SECRET=…` style names whose values must not be real. */
const SECRET_NAME = /(SECRET|PASSWORD|SERVICE_ROLE|_TOKEN|API_KEY|PRIVATE_KEY)$/;

const TEXT_EXTENSIONS =
  /\.(md|txt|json|jsonc|ya?ml|toml|ini|cfg|conf|env|example|ts|tsx|js|jsx|mjs|cjs|sql|sh|ps1|properties|gradle|xml|html|css)$/i;

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const findings = [];

for (const file of tracked) {
  if (!TEXT_EXTENSIONS.test(file)) continue;
  let contents;
  try {
    contents = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  contents.split(/\r?\n/).forEach((line, index) => {
    if (!line.includes('=')) return;
    const assignment = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!assignment) return;
    const [, name, rawValue] = assignment;
    const value = rawValue.replace(/^["']|["']$/g, '');
    if (isPlaceholder(value)) return;

    const vendor = VENDOR_PATTERNS.find(({ pattern }) => pattern.test(value));
    if (vendor) {
      findings.push({ file, line: index + 1, name, reason: vendor.label });
      return;
    }
    if (SECRET_NAME.test(name) && value.length >= 24) {
      findings.push({ file, line: index + 1, name, reason: 'looks like a real secret' });
    }
  });
}

if (findings.length > 0) {
  console.error('\nPossible committed credentials (values hidden):\n');
  for (const { file, line, name, reason } of findings) {
    console.error(`  ${file}:${line}  ${name}  — ${reason}`);
  }
  console.error(
    '\nMove the value into the git-ignored env file for that app and restore a placeholder here.',
  );
  console.error('If the value was ever pushed, rotate it at the provider.\n');
  process.exit(1);
}

console.log(`No credentials found in ${tracked.length} tracked files.`);
