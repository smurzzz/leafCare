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
