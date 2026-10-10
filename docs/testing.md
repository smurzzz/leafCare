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
| Migration | all eight tables and the `plant-photos` bucket present |
| Cron job | `POST /api/jobs/reminders` → `{"ok":true,"sent":0,"users":0}` against the live database; 403 with a wrong `x-cron-secret` |
| CORS | preflight + GET carry `Access-Control-Allow-Origin` for `APP_ORIGIN`; a foreign origin gets none |

### Signed-in flow (seeded demo account)

```bash
npm run smoke --workspace @leafcare/api -- <clerk_user_id> [baseUrl]
```

Mints a real Clerk session through the Backend API and calls every signed-in endpoint,
validating each response with the **same zod schema the mobile app enforces** — so a pass
means the API's JSON satisfies the client contract, not merely that it returned 200.

| Endpoint | Result |
| --- | --- |
| `GET /api/me`, `/api/home`, `/api/plants`, `/api/reminders`, `/api/care-log`, `/api/species?q=f` | 10/10 contract checks pass |
| `GET /api/plants/:id` | detail contract passes |
| `POST /api/plants/:id/water` | 200, and the next read shows Ficus `overdue` → `upcoming` |
| Home parity | `dueCount=3`, three due rows, **Ficus `Overdue 2d`** as the screenshots show |
| `POST /api/identify` (unmatchable photo) | **200** `{"threshold":"low","top":null,"alternatives":[]}` in ~3.6 s — no error envelope, so the app routes to screen 12 instead of the error screen; the row is stored `status=succeeded` with empty suggestions |

Row-level security, checked against the live database:

| Query | Service role (the API) | Publishable key (public) |
| --- | --- | --- |
| `plants` | 6 | 0 |
| `profiles` | 1 | 0 |
| `care_events` | 31 | 0 |
| `notification_prefs` | 1 | 0 |

With no `apikey` header the REST API answers 401. Anonymous clients therefore cannot read a
seeded user's data even with the key that ships inside the app.

**Not covered:** the vendor's *success* path needs a real leaf photo — every image in
`docs/screenshots/` is a UI mockup, which is exactly why the no-match branch above could be
exercised but the matched branch could not. The client's own rendering, camera, offline and
push all still need a device.

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
