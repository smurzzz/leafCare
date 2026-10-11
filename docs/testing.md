# Testing

## Levels

| Level | What |
| --- | --- |
| Unit | Interval/`next_due_at` math, overdue days, streak, identify threshold 0.80, unit conversion ml↔oz |
| Mobile (Jest) | Formatting copy, validation, per-user cache scoping, offline queue, reminder scheduling, theme default |
| API | Health, identify mock, plants CRUD, water, delete account isolation |
| Device | Camera, permissions, push, Clerk Google |
| UAT | Walk all 27 screens against PNGs with the demo seed |

## Identify fixture

Keep a checked-in **monstera leaf JPEG** (not a secret) under `apps/api/fixtures/monstera.jpg` for API tests. Mock Plant.id in CI; live key only locally.

## Automated checks in this repo

```bash
npm run typecheck     # packages/shared + apps/api + apps/mobile
npm run lint          # api eslint + mobile expo lint
npm test              # shared domain math + api suites + mobile Jest suite
npm run check         # docs present + scan tracked files for credentials
```

All four must be green before a build; `npm test` runs the three suites in that order.

- `tests/shared-domain.test.mjs` — `next_due_at`, overdue/due-today/upcoming
  classification and pill copy, the 0.80 identify threshold, streak rules,
  achievements and ml↔oz conversion (including a DST boundary).
- `apps/api/tests/identify-provider.test.ts` — the deterministic mock provider is
  stable for identical bytes, returns descending scores, enriches care defaults
  inside 1–60 days, and produces both `high` and `low` results across photos so
  screens 11 and 12 are both reachable without a vendor key.
- `apps/api/tests/identity.test.ts` — the Clerk→profile mapping: names and
  e-mails come from Clerk, a generated initials PNG is never stored as a photo,
  and a null from Clerk never erases a name the user set.
- `apps/mobile` — Jest, described below.

### Mobile (Jest)

The app runs under **Jest** with `jest-expo`, once for iOS and once for Android, so each
suite covers both platforms' code paths — an Android-only branch such as the reminders
channel cannot hide behind whichever platform the runner picked.

```bash
npm test --workspace @leafcare/mobile                 # both platforms
npm run test:watch --workspace @leafcare/mobile
npm run test:coverage --workspace @leafcare/mobile    # src/lib + src/theme
```

| Suite | What it pins |
| --- | --- |
| `format.test.ts` | the copy in the PNGs — `Mar 14 · 8:05 AM`, `Watered · 250 ml`, `7 wks` — and that "today" is computed in the user's timezone, not UTC |
| `validation.test.ts` | the exact messages under the auth and Add-plant fields, at their boundaries |
| `storage.test.ts` | per-user cache keys, a corrupted value read as empty, and every read/write surviving storage failing |
| `queries.test.ts` | the offline cache hydrates only the signed-in user's payloads, and sign-out clears only those |
| `mutations.test.tsx` | marking watered reschedules the device reminder; an offline tap queues instead; deleting a plant cancels its reminder |
| `notifications.test.ts` | schedule/cancel per plant, a past due date never fires immediately, permission and push-token flow, the Android channel |
| `notifications-unavailable.test.ts` | with `expo-notifications` unable to load at all (Expo Go on Android) the app keeps working and explains itself once |
| `network.test.ts` | "connected but no internet" counts as offline; reconnect flushes the queue once |
| `scan-session.test.ts` | the low-confidence paths of screens 11–12, including a provider that matched nothing |
| `config.test.ts` | the release-config guard: missing key, blank key, and a loopback API URL in a built app |
| `settings-provider.test.tsx` | **Light is the default** even on a phone in dark mode; System follows the OS; a stored or server value wins |
| `toast-bus.test.ts` | every subscriber hears a toast, and unsubscribing really stops delivery |
| `frame-analysis.test.ts` | the auto-capture framing heuristic: a textured leaf fills the frame and passes, a flat green surface does not (which is why the bar is 0.75), the same band of leaf only counts when it is **centred**, a blue or grey frame never counts, a yellowing leaf still does, plus base64/PNG decode round trips and a decode that returns `null` instead of throwing |
| `auto-capture.test.ts` | the firing rules: one good frame is not enough, motion resets the run and reports `holding`, a fire is latched so one plant can never fire twice, and `reset()` re-arms for the next plant |
| `frame-probe.test.ts` | the probe measures a 64×64 PNG made from a fast (`skipProcessing`) capture and **deletes both files it created** — including when the resizer throws and when deleting itself fails; and the framing bug below, reproduced both ways |
| `api.test.ts` | the HTTP client's own layer, which had none: the photo part is the shape Expo's `fetch` can serialise (the stub **enforces** that rule, so a regression to React Native's `{ uri, name, type }` fails here with `Unsupported FormDataPart implementation`), the Clerk token and request id go out, a server error keeps its code and message, and a cancelled request is rethrown rather than relabelled as a dead connection |
| `api-upload-unavailable.test.ts` | a build with no `expo-file-system` refuses to upload (`UPLOAD_UNAVAILABLE`, nothing attempted, no fake outage) while endpoints that carry no photo keep working |
| `use-auto-capture.test.tsx` | the loop: no probe when disabled, in the background or with no camera; three steady frames then exactly one capture and no further probes; a camera that throws does not stop it; it gives up instead of holding the lens open; it reports `blind` when no probe measures anything, and stops once one does |

Two known properties of this setup, both verified and neither a failing check:

- Jest prints `A worker process has failed to exit gracefully` at the end of a parallel run.
  `npx jest --detectOpenHandles` reports no open handles and `--runInBand` is silent: it is
  React Native's own test environment being torn down, not a leak in the app's code.
- `apps/mobile/tsconfig.json` names `jest` and `node` in `compilerOptions.types`. Expo's base
  config leaves `types` unset and this project did not pick the packages up automatically, which
  left `describe`, `it`, `expect` and `jest.fn` untyped in the suites above.

### Auto-capture calibration (real photographs)

The framing thresholds are not intuitions: the shipped `analyzeFrame` was run over real
photographs downscaled to a probe frame, and the scores are reproducible with the throwaway
harness described in the changelog. Plants whose leaves fill the frame — the shot the caption
asks for, and the shot the vendor scores highest — clear the bar with room; nothing that is not
plant matter comes close.

| Frame | Coverage | Texture | Score | Fires? |
| --- | --- | --- | --- | --- |
| Monstera deliciosa, leaves filling the frame | 0.68 | 1.00 | **1.00** | yes |
| Nephrolepis (fern), leaf mass | 0.65 | 0.85 | **0.96** | yes |
| Spathiphyllum, leaf close-up | 0.72 | 0.66 | **0.90** | yes |
| Ficus lyrata, leaf close-up | 0.84 | 0.61 | **0.89** | yes |
| Waterfall over moss (picsum) | 0.79 | 0.37 | 0.82 | yes — live greenery; the vendor then decides |
| A flat leaf-green surface (synthetic) | 1.00 | 0.00 | 0.72 | **no** — this is what sets the bar at 0.75 |
| Epipremnum on tree bark | 0.38 | 0.63 | 0.50 | no — plant too small in frame |
| Ficus benjamina, whole tree | 0.32 | 0.70 | 0.42 | no — plant too small in frame |
| Aloe vera on a table | 0.31 | 0.43 | 0.33 | no — plant too small in frame |
| Phone on a desk (picsum) | 0.01 | 1.00 | 0.28 | no |
| Cat on a branch | 0.12 | 0.61 | 0.17 | no |
| Dog on sand / laptop / city skyline (picsum) | 0.00 | 0.00 | 0.00 | no |

Three limits worth stating plainly, because they are not covered by that table:

- The table is **stills**, downscaled with a box filter. The device's own resize, a live sensor
  and a moving hand are not in it, so the numbers justify the thresholds but do not prove the
  on-device experience. `motionTolerance` in particular is the first value to tune on a phone.
- The table was measured on photographs the leaf **filled**, which is where the first report from a
  phone went wrong: the probe was measuring 62% of the whole capture, and the preview only ever
  shows a centre crop of it, so the box covered ~1.8× more width than the user could see. A plant
  framed in the guide scored **0.05** and could never fire. The probe now crops to
  `previewSquare()` — the largest centred square the preview can show — before resizing; the same
  synthetic 240×180 frame with a leaf filling the guide measures **0.05** whole-frame and **1.00**
  cropped, so `frame-probe.test.ts` fails if that crop is ever dropped again.
- Every auto-capture probe is a real capture: `expo-camera` exposes no preview frames. The probe
  deletes its files immediately, and quality 0.2 with `skipProcessing` keeps it fast, but it is
  real camera work and real battery, which is why the loop stops after 60 s.

### Verified for the Android build

Before the first APK, the app config itself is checked — `expo-doctor` and `expo install --check`
catch the failures that would otherwise only show up after a ten-minute cloud build:

```bash
cd apps/mobile
npx expo-doctor          # 21/21 checks passed
npx expo install --check # Dependencies are up to date
```

| Check | Result |
| --- | --- |
| `expo-doctor` | 21/21 — the duplicate-React failure is gone (see `troubleshooting.md`) |
| `expo install --check` | every version matches Expo SDK 57 |
| Exported bundle | `entry-*.hbc`, **7.1 MB** after auto-capture added `upng-js` (`pako`) and `expo-image-manipulator`, **one** React literal (`19.2.3`; no `19.3.0`) |
| `npm ci --dry-run` | 0 — the lockfile is in sync, which is what the builder installs from |
| EAS project | `@henry26/leafcare`, `extra.eas.projectId` set, signed in as owner |
| EAS environments | 7 `EXPO_PUBLIC_*` variables in `preview`, `development` **and** `production` |
| First `eas build -p android --profile preview` | keystore generated in the cloud; build `a3092468` started at 10/10/2026, 11:24 PM |
| Auto-capture needs its **own** build | `expo-image-manipulator` and `expo-file-system` are native modules, so build `a3092468` (built before auto-capture) does not contain them and must not be used to demo it |

Not part of a build, but true of the demo APK: `EXPO_PUBLIC_API_BASE_URL` is the laptop's LAN IP, so
the app reaches the API on the same Wi-Fi only, and Google sign-in needs the release keystore's SHA-1
registered before it will work on a device.

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
| Supabase REST | secret key authenticates against the live project; all eight tables answer — `plants`, `profiles`, `identifications`, `species_cache`, `care_events`, `reminder_log` all 200 on `?select=id`; `notification_prefs` and `achievements` have no `id` column so `?select=id` is 400 (a bad column, not a missing table) |
| Supabase Storage | `GET /storage/v1/bucket` → 200 (bucket list empty) |
| Plant identification | `npm run identify:fixture --workspace @leafcare/api -- <photo>` against **real leaf photos**, through the configured provider (`plantnet`), 1.8–2.8 s per round trip: Ficus lyrata **85.1% top → `high`**, Monstera deliciosa **79.1% top → `low`**, Hedera helix **32.3% top → `low`**. The correct species was ranked first every time |
| Identification → screen branch | 0.80 is the line: the 85.1% Ficus opens the result screen (11), the 79.1% Monstera and 32.3% ivy open the uncertain screen (12) even though the top answer was right |
| PlantNet no-match | `POST …/v2/identify/all` → 404 `Species not found` is mapped to **zero suggestions**, not a 502 |
| Protected routes | 401 `UNAUTHORIZED` with no token, a garbage token **and** a well-formed expired token |
| Migration | all eight tables, both buckets and every migrated column default present |
| Migration drift | `npm run doctor` → `7 column defaults match`; `profiles.theme` reads `light`, so `0003_profile_theme_default.sql` is applied on the live project |
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

## Verified on a phone — the scan flow (11 October 2026)

Recorded because it is the first time the scan has run end to end on hardware, and because
how it failed before is more useful than the fact that it passes now.

A scan from screen 09 now reaches the API and the vendor answers:

```
POST /api/identify 200 in 4.0s (next.js: 1.8ms, application-code: 4.0s)
POST /api/identify 200 in 3.9s (next.js: 1.4ms, application-code: 3.9s)
POST /api/identify 200 in 4.3s (next.js: 1.2ms, application-code: 4.3s)
```

The evidence is the API's own request log, taken from `next dev` on the machine the phone is
pointed at. Note what it does **not** say: which tier the provider returned, and therefore whether
the scan landed on result (11) or uncertain (12). The no-match path is covered by the API suite; the
routing itself is a function of the provider's score.

Both earlier failures were invisible from the client and produced the *same* copy, which is why
they took three rounds to separate:

- Before the framing fix there was no request at all, because auto-capture never fired: the probe
  measured a band ~1.8× wider than the preview could show.
- Before the upload fix there was still no request, this time because Expo's `fetch` threw
  `Unsupported FormDataPart implementation` on React Native's `{ uri, name, type }` part before
  opening a connection — and the client reported that as a dead network. The API log showing no
  `POST` line was the tell that separated "never sent" from "sent and failed".

Still unmeasured on hardware: the probe cadence and `motionTolerance` (see the calibration limits
above), what `expo-file-system` derives as filename and content type for a HEIC or PNG pick, and
iOS — everything here is Android, in Expo Go.

## Devices

- Android physical (camera + APK)
- iOS simulator (gallery pick) and device if available
