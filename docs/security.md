# Security

## Identity

- Clerk is the identity provider (email/password, Google, email OTP).
- Never roll a custom password hasher on the API.
- Sessions: Clerk JWT on every API call.
- Log out revokes the Clerk session.

## Secrets

| Secret | Where |
| --- | --- |
| `CLERK_SECRET_KEY` | Next.js only |
| `CLERK_WEBHOOK_SECRET` | Next.js only |
| `SUPABASE_SERVICE_ROLE_KEY` | Next.js only |
| `PLANT_ID_API_KEY` | Next.js only |
| Publishable Clerk + Supabase anon | Expo public env OK |

`.env` is gitignored. Rotate keys if they appear in a client bundle or screenshot.

## Plant photos

- Capture stays on device until identify upload to **our** API.
- Identify images may be ephemeral; persist to Storage only when the user saves a plant.
- Signed URLs, short TTL.
- Copy on permission screen is a product promise: do not upload to analytics or third parties other than Plant.id for identification.

## Data isolation

- Every query filters `clerk_user_id`.
- RLS on when Clerk JWT is wired to Supabase.
- Delete account removes plants, photos, care_events, prefs, then Clerk user.

## API hardening

- Max upload 8MB; only jpeg/png/heic
- Rate-limit `/api/identify` (e.g. 20/hour/user) to protect Plant.id spend
- Validate UUIDs; no mass assignment of `clerk_user_id`
- CORS only for the Expo app origin if any web preview exists
- Webhook signature required

## Notifications

- Store Expo tokens per user; do not log tokens
- Honor quiet hours
- No plant-care PII in push title beyond nickname the user chose

## Client

- No debug plant-id proxy in Expo
- Screenshot/debug builds must not embed `.env`
- Password fields use secure text; OTP is not logged

## Student / classroom note

Do not commit real Plant.id or Clerk production keys. Use test instances.
