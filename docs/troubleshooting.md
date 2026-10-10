# Troubleshooting

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
