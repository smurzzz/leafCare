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

- Theme not following OS: segmented control must be `system` and subscribe to Appearance.
- 250 ml still showing in Imperial: convert only in UI from `amount_ml`.

## Delete account

- Clerk user gone but plants remain: webhook `user.deleted` or `DELETE /api/me` failed mid-way — make DB wipe first, then Clerk.

## Agent pitfalls

- Building the Vite UI kit as the product — wrong, see AGENTS.md
- Inventing disease diagnosis
- Putting Plant.id key in Expo
- Skipping empty/error/permission screens 19, 24, 25, 26
