/**
 * LeafCare is a two-app monorepo: the Expo app lives in `apps/mobile`, the API in
 * `apps/api`. This repository root is not an Expo project.
 *
 * Expo treats any directory that has a `package.json` and a hoisted `expo` install as a
 * project, so `npx expo start` here boots a phantom app rooted at the repo root. The bundle
 * it serves has no screens, and every asset request resolves against this folder — which has
 * no `assets/` — so the Metro log fills with
 *
 *   Error: ENOENT: no such file or directory, scandir '<repo>/assets/images'
 *
 * Stopping here, with the right command, beats starting a server that serves nothing. The
 * message is printed without a stack trace because this is a monorepo layout guard, not a
 * crash.
 */
const lines = [
  '',
  'LeafCare is a monorepo, and the Expo app lives in apps/mobile.',
  '',
  '  Start the app from here:  npm start        (same as npm run mobile)',
  '  Or directly:              cd apps/mobile && npx expo start',
  '',
  'Starting Expo in this folder would serve an empty app and fail every asset request',
  'with "ENOENT ... assets/images", which is what this guard prevents.',
  '',
];

console.error(lines.join('\n'));
process.exit(1);
