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
