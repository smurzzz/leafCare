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

```bash
cd apps/mobile
npx eas login
npx eas build --platform android --profile preview
```

- `preview` profile: APK for classroom demo
- Production AAB only if Play Store is in scope (it is **not** required by the proposal)

iOS build needs Apple developer account; optional for the 8-week plan.

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
- The **first** Android build asks EAS to generate a keystore. That prompt is interactive, so run it
  yourself rather than from a script — `--non-interactive` fails when no credentials exist yet.
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
