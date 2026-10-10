# Testing

## Levels

| Level | What |
| --- | --- |
| Unit | Interval/`next_due_at` math, overdue days, streak, identify threshold 0.80, unit conversion ml↔oz |
| API | Health, identify mock, plants CRUD, water, delete account isolation |
| Device | Camera, permissions, push, Clerk Google |
| UAT | Walk all 27 screens against PNGs with the demo seed |

## Identify fixture

Keep a checked-in **monstera leaf JPEG** (not a secret) under `apps/api/fixtures/monstera.jpg` for API tests. Mock Plant.id in CI; live key only locally.

## Automated checks in this repo

```bash
npm run typecheck     # packages/shared + apps/api + apps/mobile
npm test              # shared domain math + identify provider contract
```

- `tests/shared-domain.test.mjs` — `next_due_at`, overdue/due-today/upcoming
  classification and pill copy, the 0.80 identify threshold, streak rules,
  achievements and ml↔oz conversion (including a DST boundary).
- `apps/api/tests/identify-provider.test.ts` — the deterministic mock provider is
  stable for identical bytes, returns descending scores, enriches care defaults
  inside 1–60 days, and produces both `high` and `low` results across photos so
  screens 11 and 12 are both reachable without a vendor key.

### Verified against a running server (real keys)

Run with the Clerk, Supabase and PlantNet keys from `apps/api/.env.local`:

```bash
npm run doctor --workspace @leafcare/api    # probes each integration for real
```

| Check | Result |
| --- | --- |
| `next build` | 20 routes compile |
| `GET /api/health` | `clerk`, `supabase`, `webhook`, `push` all `true` |
| Clerk Backend API | secret key accepted (0 users on the instance) |
| Supabase REST | secret key authenticates; PGRST205 for all eight tables |
| Supabase Storage | `GET /storage/v1/bucket` → 200 (bucket list empty) |
| PlantNet | key accepted, `POST …/v2/identify/all` → 404 `Species not found` for mockup images, mapped to **zero suggestions**, not a 502 |
| Protected routes | 401 `UNAUTHORIZED` with no token, a garbage token **and** a well-formed expired token |
| Cron job | 403 with a wrong `x-cron-secret`; 500 only because the tables are missing |
| CORS | preflight + GET carry `Access-Control-Allow-Origin` for `APP_ORIGIN`; a foreign origin gets none |

**Not covered:** the vendor's success path needs a real leaf photo — every image in
`docs/screenshots/` is a UI mockup and matches nothing. Any signed-in flow (plants, water,
reminders, care log) is blocked until the migration is applied, because there is no user id
to authenticate with yet.

### Verified against a running server (no keys)

`GET /api/health` → 200 with an `integrations` report; every protected route
(`/api/home`, `/api/plants`, `/api/reminders`, `/api/care-log`, `/api/me`,
`/api/me/notifications`, `/api/species`, `POST /api/identify`) → 401 with the
`{ error: { code, message } }` envelope when the bearer token is missing;
`POST /api/webhooks/clerk` → 400 when the signature is absent; missing secrets
surface as 503 `CONFIG_ERROR` naming the variable instead of a 500.

## Screen UAT checklist

For each ID 01–27:

1. Layout matches PNG (spacing, chips, copy)
2. Primary CTA works
3. Back/close works
4. Empty/error/permission variant if specified

Critical paths:

- New user: Splash → onboarding → sign up → OTP → empty reminders → add via scan → home due card
- Returning: Log in → home → mark watered → toast
- Uncertain ID: dark photo → screen 12 → retake vs pick match
- Overdue: Ficus coral card on Home and My Plants
- Delete account: modal copy includes plant count

## Auth cases

- Wrong password
- Resend OTP after timer
- Google cancel
- Session restore on relaunch (skip splash-to-login)

## Notification cases

- Toggle off → no pushes
- Snooze 1h vs 3h vs Tomorrow
- Quiet hours: trigger at 10:30 PM is delayed to 7:00 AM

## Offline

- Airplane mode on Home → banner 26
- Identify while offline → error 25
- Water while offline: queue or disable + banner (document which was implemented)

## Devices

- Android physical (camera + APK)
- iOS simulator (gallery pick) and device if available
