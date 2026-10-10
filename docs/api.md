# API

Base URL: `EXPO_PUBLIC_API_BASE_URL` (Next.js).

All routes except `/api/health` and `/api/webhooks/clerk` require:

```
Authorization: Bearer <clerk_session_jwt>
```

JSON errors:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "..." } }
```

## Health

`GET /api/health` → `{ "ok": true }`

## Identify

`POST /api/identify`  
`multipart/form-data` field `image` (jpeg/png, max 8MB)

Response:

```json
{
  "identificationId": "uuid",
  "threshold": "high" | "low",
  "top": {
    "scientificName": "Monstera deliciosa",
    "commonName": "Swiss cheese plant",
    "score": 0.94,
    "intervalDays": 7,
    "light": "Bright indirect",
    "difficulty": "Easy",
    "care": { "lightDetail": "…" }
  },
  "alternatives": [
    { "scientificName": "Monstera adansonii", "score": 0.84 }
  ]
}
```

`threshold` is `high` when `top.score >= 0.80`.

`DELETE /api/identify/:id` — cancel / discard temp photo (Cancel on screen 10).

`GET /api/species?q=` — manual search for screen 12.

## Plants

`GET /api/plants` — list with computed `status`: `due_today` | `overdue` | `upcoming`, `overdueDays`, `dueInDays`, signed `photoUrl`. Query: `filter=all|due_today|location:{kind}` , `q=`

`POST /api/plants`

```json
{
  "identificationId": "uuid?",
  "nickname": "Monty",
  "speciesScientific": "Monstera deliciosa",
  "speciesCommon": "Monstera deliciosa",
  "locationKind": "living_room",
  "locationCustom": null,
  "intervalDays": 7,
  "lastWateredAt": "2026-03-08T00:00:00.000Z",
  "reminderTime": "08:00",
  "photo": "(or reuse identification photo)",
  "notes": "",
  "confidence": 0.94
}
```

`GET /api/plants/:id` — detail including care cards, next watering label.

`PATCH /api/plants/:id` — nickname, location, notes, photo, interval, reminderTime.

`DELETE /api/plants/:id`

`POST /api/plants/:id/water`

```json
{ "amountMl": 250, "source": "home" }
```

Updates `last_watered_at`, `next_due_at`, streak, inserts `care_events`, returns toast payload `{ "message": "Monty watered" }`.

`POST /api/plants/:id/schedule/reset` — restore `recommended_interval_days`.

## Care log

`GET /api/care-log?month=2026-03&plantId=`

```json
{
  "days": { "2026-03-01": "watered", "2026-03-03": "missed" },
  "wateringsThisMonth": 12,
  "deltaVsPrevMonth": 3,
  "missedDays": 2,
  "recent": [
    {
      "id": "…",
      "type": "watered",
      "amountMl": 250,
      "plantNickname": "Monty",
      "occurredAt": "2026-03-14T08:05:00.000Z",
      "photoUrl": "…"
    }
  ]
}
```

## Home

`GET /api/home` — greeting name, due count, headline sentence, today rows, upcoming rows, streak chip.

## Reminders

`GET /api/reminders?tab=upcoming|completed`

Groups: `today`, `tomorrow`, `this_week` with `{ plantId, title: "Water Monty", time, photoUrl }`.

`POST /api/reminders/:plantId/snooze` `{ "preset": "1h"|"3h"|"tomorrow" }`

`POST /api/reminders/:plantId/done` — same as water.

## Profile & settings

`GET /api/me` — profile, stats `{ plants, streakDays, waterings }`, achievements.

`PATCH /api/me` — fullName, theme, units, avatar.

`GET|PUT /api/me/notifications` — prefs + expo token.

`POST /api/me/push-token` `{ "token": "ExponentPushToken[…]" }`

`DELETE /api/me` — delete all user rows, storage, then caller deletes Clerk user (or API uses Clerk backend SDK).

## Webhooks

`POST /api/webhooks/clerk` — `user.created` upsert profile; `user.deleted` cascade wipe.

Verify `CLERK_WEBHOOK_SECRET`.

## Plant.id mapping (server)

Do not document vendor keys in the client. Map `suggestions[].name` + `probability` to our DTO. If care data missing, default interval 7 days, light “Bright indirect”, difficulty “Easy”.
