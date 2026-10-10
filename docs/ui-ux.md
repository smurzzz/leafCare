# UI / UX

Visual source of truth: `docs/screenshots/*.png` and `docs/screenshots/manifest.json`.

The Enter/Vite UI kit in Downloads is a **web mock**. Recreate the same look in React Native (not CSS-only shadcn).

## Screenshot index

| Order | Label | File |
| --- | --- | --- |
| 1 | Splash | `01-splash.png` |
| 2 | Onboarding — slide 1 | `02-onboarding-slide-1.png` |
| 3 | Onboarding — slide 2 | `03-onboarding-slide-2.png` |
| 4 | Onboarding — slide 3 | `04-onboarding-slide-3.png` |
| 5 | Sign up | `05-sign-up.png` |
| 6 | Log in | `06-log-in.png` |
| 7 | Verify email | `07-verify-email.png` |
| 8 | Home / Today | `08-home-today.png` |
| 9 | Scan — camera | `09-scan-camera.png` |
| 10 | Identifying | `10-identifying.png` |
| 11 | Scan result | `11-scan-result.png` |
| 12 | Low confidence | `12-low-confidence.png` |
| 13 | Add plant | `13-add-plant.png` |
| 14 | My Plants | `14-my-plants.png` |
| 15 | Plant detail | `15-plant-detail.png` |
| 16 | Edit schedule | `16-edit-schedule.png` |
| 17 | Care log | `17-care-log.png` |
| 18 | Reminders | `18-reminders.png` |
| 19 | Reminders — empty | `19-reminders-empty.png` |
| 20 | Notification settings | `20-notification-settings.png` |
| 21 | Profile | `21-profile.png` |
| 22 | Settings / account | `22-settings-account.png` |
| 23 | Settings — delete confirm | `23-settings-delete-confirm.png` |
| 24 | State — camera permission | `24-state-camera-permission.png` |
| 25 | State — error | `25-state-error.png` |
| 26 | State — loading & offline | `26-state-loading-offline.png` |
| 27 | State — success toast | `27-state-success-toast.png` |
| — | Full board | `00-full-gallery-board.png` |

## Design tokens (from screens)

Approximate; match PNGs if these drift.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#F6F3EE` cream | App background |
| `--surface` | `#FFFFFF` | Cards |
| `--ink` | `#1A1A1A` | Titles |
| `--muted` | `#6B7280` | Subtitles |
| `--forest` | `#1F6B4A` / `#1B5E45` | Primary buttons, selected chips |
| `--forest-deep` | `#163D2E` | Splash, toast |
| `--mint` | `#E7F4EA` | Icon wells, summary cards |
| `--mint-icon` | `#CDE8D4` | Circular icon bg |
| `--coral` | `#E57373` / `#F97066` | Danger, overdue, delete |
| `--coral-bg` | `#FDECEC` / `#F8D7D7` | Danger zone, error halo |
| `--blue-action` | `#3B82F6` | Snooze |
| `--ring` | `#D8E5DC` | Card border |
| `--streak` | `#E85D04` | Flame streak |

Radius: cards ~20–24; buttons ~16–20 pill; inputs ~16 with light green border; circular icon buttons 40–48.

Type: large bold titles (SF Pro / system), regular muted body. Section labels uppercase tracking (ACCOUNT, PREFERENCES).

## Components to build

- `PrimaryButton` forest fill, white label, full width
- `SecondaryButton` white, forest border/text
- `DangerButton` coral fill
- `TextButton` muted or forest
- `IconWell` mint circle + glyph
- `Input` labeled uppercase + leading icon
- `SegmentedControl` (theme, units, snooze, upcoming/completed)
- `FilterChip` / `LocationChip`
- `PlantCard` grid
- `CareRow` home list
- `TabBar` + raised Scan FAB
- `Sheet` grabber
- `Toast` forest
- `Skeleton` rounded bars
- `CircularCountdown` watering ring
- `OtpBoxes` × 6
- `PasswordMeter`
- `AchievementChip`
- `OfflineBanner`

Illustrations: recreate simply with RN SVG or export from the UI kit. Do not ship random stock that changes the story (cracked sad pot, sleeping plant, scan leaf, watering calendar).

## Motion

- Identifying progress bar indeterminate + count-up of matches
- Scan auto-capture: the mint ring under the caption fills across the probes that precede a shot,
  and the frame border turns solid mint on the frame that fires — the capture always announces
  itself before it happens
- Toast slides from top
- Sheets slide up
- Onboarding horizontal pager
- Tab bar no layout jump when FAB centered

## Accessibility

- 44pt min hit targets on shutter, water buttons, chips
- Contrast on forest/white
- OTP fields announce digit n of 6
- Reduce-motion: skip match count animation

## Breakpoints

Phone-first. Design against iPhone 14/15 (~393×852). Tablet not required for v1.
