# Requirements

## General objective

Design and develop a mobile application that identifies plants from a camera photo and provides personalized watering reminders.

## Specific objectives

1. Photograph or upload a plant and receive species identification via an external plant-ID API.
2. Generate a recommended watering schedule from the identified species.
3. Maintain a personal plant collection with photos and care history.
4. Send push notifications when each plant needs water.
5. Keep the system secure, scalable, and maintainable (Clerk + RLS + server-side API keys).

## In scope

- Camera capture, gallery pick, flash, camera flip
- Camera permission pre-prompt
- Species identification with confidence and alternative matches
- Low-confidence path with tips and retake
- Manual “search” fallback from the uncertain screen (species picker — no marketplace)
- Add plant: nickname, location chips + custom, last watered, interval stepper
- My Plants grid with filters (All, Due today, rooms)
- Plant detail: next watering ring, mark watered, last/every/streak, Care / History / Notes tabs
- Edit watering schedule bottom sheet; reset to recommended; delete plant
- Care log calendar (watered / missed / no data) + recent activity
- Reminders upcoming/completed; Done and Snooze; empty state
- Notification settings: watering reminders toggle, daily digest time, snooze duration, overdue nudges, quiet hours copy
- Profile: avatar, stats, achievements, account shortcuts
- Settings: email, change password, theme, units, version, legal links, danger zone delete
- Auth: sign up, login, Google, password strength, forgot password, 6-digit email verify, resend cooldown
- Splash + 3-slide onboarding with skip
- Global states: loading skeleton, offline banner, generic error + try again, success toast
- Light / System / Dark theme
- Metric / Imperial units (volume and temperature copy)

## Out of scope

- Disease or pest diagnosis
- Marketplace / shop
- Soil sensors or other IoT
- Social following or public plant feeds
- Multi-user household sharing (v1 is single owner)
- Web app as the primary product (Expo web optional later, not required)

## Functional requirements by module

### User management

| ID | Requirement |
| --- | --- |
| UM-1 | Register with full name, email, password |
| UM-2 | Password strength meter (weak → good) as in sign-up PNG |
| UM-3 | Continue with Google |
| UM-4 | Log in with email + password; show/hide password |
| UM-5 | Forgot password |
| UM-6 | 6-digit email verification with resend timer |
| UM-7 | Session via Clerk; log out from Profile |
| UM-8 | Edit profile (name, avatar) |
| UM-9 | Change password; show “last changed” |
| UM-10 | Delete account with confirm modal listing plant count |

### Identification

| ID | Requirement |
| --- | --- |
| ID-1 | Full-screen camera with leaf frame and “Center the leaf in the frame” |
| ID-2 | Shutter, gallery thumbnail, flash toggle, close, flip camera |
| ID-3 | If permission missing, dedicated allow-camera screen |
| ID-4 | Identifying sheet: spinner, “Matching leaf shape, texture and vein pattern”, live “Found N possible matches so far”, cancel |
| ID-5 | High confidence result (≥ ~80%): species, match chip, water/light/difficulty cards, other matches, Add to My Plants, Retake |
| ID-6 | Low confidence: “We’re not quite sure”, tips, ranked possible matches, Retake, Search manually |
| ID-7 | Photos stay on device until the user saves the plant |

### Collection & care

| ID | Requirement |
| --- | --- |
| PL-1 | Save plant with photo, species, nickname, location, last watered, interval |
| PL-2 | Locations: Living room, Bedroom, Kitchen, Office, + Custom |
| PL-3 | Recommended interval badge when using species default |
| PL-4 | Mark as watered from Home, Detail, and Reminders |
| PL-5 | Care log entries with volume (metric ml / imperial oz) |
| PL-6 | Streak increments when watering is not missed |
| PL-7 | Overdue styling after missed scheduled day |
| PL-8 | Notes tab on plant detail (free text) |
| PL-9 | Delete plant from schedule sheet |

### Notifications

| ID | Requirement |
| --- | --- |
| NT-1 | Per-plant reminder at configured time |
| NT-2 | Daily care digest at “Daily reminder time” |
| NT-3 | Snooze 1h / 3h / Tomorrow (default 3h) |
| NT-4 | Overdue nudge next day if toggle on |
| NT-5 | Quiet hours copy: 10:00 PM – 7:00 AM local |
| NT-6 | Master watering-reminders toggle |

### Cross-cutting

| ID | Requirement |
| --- | --- |
| XC-1 | Offline banner + skeletons; plants remain locally readable if cached |
| XC-2 | Error screen with Try again and Contact support |
| XC-3 | Success toast after watering |
| XC-4 | Version shown as `x.y.z(build)` |

## Non-functional

- Expo Android + iOS
- Identify request typically < 15s with progress UI
- Auth tokens never logged
- Plant-ID API key only on server
- Accessible contrast on cream + forest green theme
- Scalable per-user plant lists (hobbyist: dozens of plants)
