# Deployment

## Environments

| Env | API | Clerk | Supabase | Plant.id |
| --- | --- | --- | --- | --- |
| Local | localhost:3000 | test | test | test key |
| Preview | Vercel preview | test | test | test |
| Production | Vercel prod | prod | prod | paid/test per school rules |

Expo talks to `EXPO_PUBLIC_API_BASE_URL`. For device testing, use a tunnel or LAN IP, not `localhost`.

## API (Next.js)

1. Set secrets on the host (Vercel or similar)
2. `CLERK_WEBHOOK_SECRET` pointing to `/api/webhooks/clerk`
3. Apply SQL migrations to the matching Supabase project
4. Confirm `/api/health`

## Mobile (EAS)

Before building, all four local gates must be green — a build is slow and the failures are cheaper
here (`docs/testing.md`):

```bash
npm run typecheck && npm run lint && npm test && npm run check
```

Then check the app's own config before spending a cloud build, and build:

```bash
cd apps/mobile
npx expo-doctor            # catches duplicate native modules and config drift
npx expo install --check   # dependency versions against the SDK
npx eas login
npx eas build --platform android --profile preview
```

`--non-interactive` is safe for the first Android build: with no locally installed `keytool`, EAS
reports *"Detected that you do not have keytool installed locally. Generating keystore in the cloud…"*
and proceeds without asking anything. Each profile in `eas.json` also names its own `environment`, so
`preview` cannot pick up another profile's variables.

- `preview` profile: APK for classroom demo
- Production AAB only if Play Store is in scope (it is **not** required by the proposal)

iOS build needs Apple developer account; optional for the 8-week plan.

## Build configuration lives in EAS, not in `.env`

`eas build` uploads the project **minus everything in `.gitignore`**, and `apps/mobile/.env` is
ignored — so a build never sees it and every `EXPO_PUBLIC_*` value would be undefined. The values are
held in the EAS environment instead:

```bash
cd apps/mobile
npx eas env:push --environment preview     --path .env --force
npx eas env:push --environment development --path .env --force
npx eas env:push --environment production  --path .env --force
npx eas env:list  --environment preview    # names only, values stay out of the terminal
```

All seven are `EXPO_PUBLIC_*` — public by design, already inlined in every bundle you have shipped —
so pushing them stores no secret. `EXPO_PUBLIC_API_BASE_URL` is the one to change per environment:
the LAN IP for a laptop demo, an HTTPS host for anything real. If a build is missing them, the app now
says so at startup rather than showing empty screens (`troubleshooting.md`).

## Android release builds and cleartext HTTP

Android blocks cleartext HTTP from `targetSdkVersion` 28 on, and Expo's template only allows it in the
**debug** manifest — so a release APK cannot talk to `http://…:3000`. `expo-build-properties` in
`app.json` sets `android.usesCleartextTraffic: true`, which lands in the main manifest and therefore
applies to release builds. Prefer hosting the API over HTTPS and removing the flag.

## Development build (the only way to test push)

**Expo Go cannot deliver a push notification on Android — remote notifications were removed from
it in SDK 53, and the package throws on import there.** Everything upstream of the phone does work:
`POST /api/jobs/reminders` authenticates with `x-cron-secret` (403 without it) and sends through
Expo's push service. What is missing is a build of *our* app on the device that can receive one.

```bash
cd apps/mobile
npx eas build --platform android --profile development
npx expo start --dev-client        # then open the installed LeafCare dev app
```

- `expo-dev-client` is already in `package.json`; the `development` profile in `eas.json` sets
  `developmentClient: true` and `distribution: internal`.
- The **first** Android build creates the keystore for you — in the cloud, with no prompt and no
  local `keytool` required (verified with `--non-interactive`). Keep `eas-cli` up to date, and see
  `eas credentials` if you ever need to rotate it.
- After installing, sign in and open **Notification settings** → allow notifications. That call is
  what stores the Expo push token the reminder job reads; until a device registers one, the job
  reports `sent: 0` no matter how many plants are due.
- Local schedules still work in development builds too, so a due plant reminds you even with the
  API asleep.

## App config

- Name: LeafCare
- Version on Settings screen: `1.0.0(buildNumber)` — mock PNG shows `1.2.0(248)` as design only
- Permissions strings: camera, photos, notifications — explain plant identification

## Go-live checklist

- [ ] Seed or create Alex demo account
- [ ] Google OAuth redirect URIs include the Expo scheme
- [ ] Plant.id quota monitored
- [ ] Support email reachable from error screen
- [ ] Privacy policy + terms URLs live (even simple markdown pages)

## Rollback

Point `EXPO_PUBLIC_API_BASE_URL` back to previous API deployment; EAS update or reinstall APK.
