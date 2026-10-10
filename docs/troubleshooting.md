# Troubleshooting

## Metro serves the wrong project

- Symptom is a bundle that loads but has no icons or splash: `Error: ENOENT ... no such file or
  directory, scandir '<repo root>\assets\images'`, or `Asset not found` for an asset that is
  right there in `apps/mobile/assets/images/`.
- Cause: `expo start` was run from the **monorepo root**, so Expo treated the root `package.json`
  as the app (`main: expo/AppEntry`, version `0.1.0`). The root has no `app.json`, so nothing
  complains — it just serves assets relative to the wrong directory. The manifest confirms it:
  `curl -H 'expo-platform: android' http://localhost:8081/` reports
  `extra.expoClient._internal.projectRoot`, which must end in `apps/mobile`.
- Fix: run it in `apps/mobile` (`npm run mobile` from the root already does). Side effects of a
  misrooted run — a root `tsconfig.json` extending `expo/tsconfig.base` and a root `.expo/` — are
  safe to delete.
- Expo itself rewrites `tsconfig.json#include` on start, which shows up as a local diff; that is
  expected, not corruption.

## Expo cannot reach API

- Physical device: `localhost` is the phone. Use LAN IP (`http://192.168.x.x:3000`) or a tunnel.
- Cleartext HTTP: enable in Expo app config for debug only.
- CORS: native fetch does not use browser CORS; if testing Expo web, allow origin.

## Clerk

- **Redirect mismatch** on Google: add `leafcare://` and Expo auth proxy URLs in Clerk dashboard.
- OTP never arrives: check Clerk email settings; development may log the code in Clerk dashboard.
- `Missing publishable key`: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` not loaded; restart Expo after `.env` change.

## Plant identification

- Always 12 low-confidence: photo too dark/wide; also check API mapped `probability` 0–1 vs 0–100.
- 401/403 from Plant.id: key on **server** env, not Expo.
- Slow identifying: still show screen 10; timeout ~20s then screen 25.

## Supabase

- Empty plant list after save: `clerk_user_id` mismatch between webhook and API JWT `sub`.
- Photo broken: bucket private without signed URL.
- RLS blocking: if using service role only in API, do not init service role in the app.

## Camera

- Black preview: permission not granted — must hit screen 24 / OS settings.
- Simulator: use gallery path; shutter may be disabled with a hint.

## Notifications

- No pushes on Android: missing notification permission + FCM/EAS credentials.
- Duplicate reminders: job not idempotent; key by `plant_id` + `due_date`.
- Arrives at night: quiet hours not applied in the sender.

## A built APK says "This build is incomplete"

- Symptom: the installed app opens straight into the dark setup screen instead of sign-in, or shows
  every screen's error state. Nothing on the phone explains why.
- Cause: **`.env` is gitignored, so EAS never uploads it.** `eas build` excludes anything matched by
  `.gitignore` (unless a `.easignore` says otherwise), so `apps/mobile/.env` is absent from the build
  and every `EXPO_PUBLIC_*` value is undefined: no Clerk publishable key, no API URL, no Supabase
  URL. The bundle then falls back to `http://localhost:3000`, which on a phone is the phone.
- Fix: put the values in the **EAS environment**, not a file — `cd apps/mobile && npx eas env:push
  --environment preview --path .env --force` (repeat for `development` and `production`; verify with
  `npx eas env:list --environment preview`). All seven values are `EXPO_PUBLIC_*`, which are public by
  design and ship inside every bundle, so this leaks nothing.
- `releaseConfigIssue()` in `lib/config.ts` now fails loudly at startup in a release build, naming the
  exact value that is missing, instead of presenting an app that looks broken.

## A built APK cannot reach the API over http://

- Symptom: the app installs and runs, but every request fails — in a *release* build only; the same
  code works in Expo Go and in debug builds.
- Cause: Android blocks cleartext HTTP by default from `targetSdkVersion` 28 onward, and Expo's
  template only sets `usesCleartextTraffic` in the **debug** manifest. A release APK therefore cannot
  call `http://192.168.100.133:3000`.
- Verified directly: `npx expo prebuild --platform android --no-install`, then
  `grep usesCleartextTraffic android/app/src/main/AndroidManifest.xml`. Without the config below the
  main manifest has **0** occurrences (the debug one has 1); with it, the main manifest carries
  `android:usesCleartextTraffic="true"`, which is what a release build uses.
- Fix (already applied): `expo-build-properties` with `android.usesCleartextTraffic: true` in
  `app.json`. Prefer an HTTPS API in production and remove this then.
- Even with cleartext, the LAN URL requires the phone to share the laptop's network **and** the API to
  be running (`npm run api`) at that IP. The housekeeping note: a dynamic DHCP lease can change it.

## Expo Go on Android: every route "missing the required default export"

In Expo Go on Android (SDK 53+) this cascade is **one** error repeated, not many:

```
ERROR  expo-notifications: Android Push notifications ... removed from Expo Go with SDK 53
WARN   Route "./_layout.tsx" is missing the required default export
WARN   Route "./(tabs)/profile.tsx" is missing the required default export
ERROR  [TypeError: Cannot read property 'ErrorBoundary' of undefined]
```

- Cause: `expo-notifications` throws while it is being **imported** on Android in Expo Go — its
  `index.js` re-exports `DevicePushTokenAutoRegistration.fx`, whose module body calls
  `addPushTokenListener()` → `warnOfExpoGoPushUsage()`, which throws. A module that throws during
  evaluation fails its whole import graph, so the root layout never gets a default export and
  expo-router reports the *importer* of the package as a broken route. The listed routes are
  exactly the ones that reach the package.
- Fix: never import it statically. `src/lib/notifications.ts` loads it through a dynamic
  `await import('expo-notifications')` inside a try/catch, so the package is evaluated on first
  use and a failure is a skipped feature rather than a dead app. Do not move that call, or any
  other native call, back to module scope.
- A static `import type` / `typeof import(...)` is fine: types are erased and never evaluate.
- Real push still needs a development build or the EAS APK; Expo Go on Android can only skip it.

## Theme / units

- Expected: a fresh install is **Light**, even on a phone in dark mode. LeafCare's cream/forest look
  is the product's identity, and only an explicit choice may change it — pick **System** in
  Settings → Preferences to follow the OS. The column default is `light`
  (`0003_profile_theme_default.sql`), and the app defaults to the same value before `/api/me`
  answers, so the first frame is already correct.
- Theme not following OS: the segmented control must be on `system`, which subscribes to
  Appearance. On `light` or `dark` the app intentionally ignores the phone's setting.
- A **new** profile arrives as System: the migration has not been applied to that project. Run
  `npm run doctor --workspace @leafcare/api` — the **Migration drift** row names the column and both
  values, e.g. `profiles.theme is 'system' — expected 'light'`.

## Delete account

- Clerk user gone but plants remain: webhook `user.deleted` or `DELETE /api/me` failed mid-way — make DB wipe first, then Clerk.

## Duplicate React (Expo doctor's "duplicate dependencies" check)

- Symptom: `npx expo-doctor` fails "Check that no duplicate dependencies are installed" with
  `react@19.2.3` in the app and another `react` at the workspace root, or a screen dies with
  "Invalid hook call" / `Cannot read properties of null (reading 'useState')` while others are fine.
- Cause: a package's **peer** range pulled a second React to the root. Ours was dev-only —
  `test-renderer` (a peer of `@testing-library/react-native`) needs `react-reconciler@~0.34.0`, whose
  peer is `react: ^19.3.0`. npm `overrides` do **not** move a peer auto-install, so `"overrides"`
  looked right and changed nothing.
- Fix: declare `react`/`react-dom` at the workspace root at the version `expo/bundledNativeModules.json`
  pins (19.2.3 for SDK 57) so the hoisted copy is the app's copy, and let the reconciler keep a nested
  one. `jest.config.js` resolves `react` for the same reason; never hard-code `<rootDir>/node_modules/react`.
- Verify: `npx expo-doctor` → 21/21, and after `npx expo export --platform android`,
  `grep -a -c '19\.3\.0' dist/_expo/static/js/android/*.hbc` must be 0.

## Agent pitfalls

- Building the Vite UI kit as the product — wrong, see AGENTS.md
- Inventing disease diagnosis
- Putting Plant.id key in Expo
- Skipping empty/error/permission screens 19, 24, 25, 26
