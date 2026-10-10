# Screen specification

Every screen in `docs/screenshots/` must be implemented. Screenshot file names are the ID.

Navigation chrome: iOS-style status bar **9:41**. Authenticated tabs: **Home · My Plants · Scan (center FAB) · Reminders · Profile**. Scan FAB is a dark-green circle with a scan-frame icon, overlapping the tab bar.

Shared visual language is in `ui-ux.md`. This file is **behavior**.

---

## 01 — Splash

**File:** `01-splash.png`  
**When:** First paint before onboarding/auth. Optional branded launch on cold start.

**UI**

- Full forest-green background with faint leaf silhouettes
- Concentric rings around a white water-drop logo (inner pale-green droplet)
- Title **LeafCare**
- Subtitle **Know your plant. Keep it alive.**
- Page indicator: first dash + two dots (this is also onboarding page 0 / teaser)
- Footer **Tap anywhere to continue**

**Behavior**

- Tap anywhere or wait ~2s → if onboarding incomplete → `02`; else if signed out → `06`; else → `08`
- Do not show tab bar

---

## 02 — Onboarding slide 1

**File:** `02-onboarding-slide-1.png`

**Copy**

- Header left: LeafCare · right: **Skip**
- Illustration: person holding phone, scan beam, potted plant in blue corner brackets
- Title: **Identify any plant in seconds**
- Body: **Point your camera at a leaf and get the exact species, plus a care plan built around it.**
- Dots: first active
- Primary: **Next**

**Behavior**

- Next → `03`
- Skip → `05` (or `06` if they already have an account flag — default Skip to sign-up)

---

## 03 — Onboarding slide 2

**File:** `03-onboarding-slide-2.png`

**Copy**

- Title: **Never forget to water again**
- Body: **We build a watering schedule around your plant and your routine, then nudge you right on time.**
- Illustration: calendar with green/pink dots + watering can
- Dots: second active
- **Next** → `04`; **Skip** same as slide 1

---

## 04 — Onboarding slide 3

**File:** `04-onboarding-slide-3.png`

**Copy**

- Title: **Watch your plant family grow**
- Body: **Log every watering, build streaks, and see how your plants thrive across the seasons.**
- Illustration: smiling plant under a bell with sparkles
- Dots: third active
- Primary: **Get Started** → `05`
- Skip still visible → `05`

Persist `hasOnboarded=true` after Get Started or Skip.

---

## 05 — Sign up

**File:** `05-sign-up.png`

**UI**

- Logo + **LeafCare**
- Title **Create your account**
- Subtitle **Start identifying plants and never miss a watering day.**
- Fields (labels uppercase):
  - **FULL NAME** — person icon, placeholder filled example: Alex Morgan
  - **EMAIL** — @ icon
  - **PASSWORD** — bullets + eye toggle
- Password strength bar: three segments (two filled teal, one empty) + label **Good** (states: Weak / Fair / Good)
- Primary **Sign Up**
- Divider **or continue with**
- Outline **G Continue with Google**
- **Already have an account? Log in**
- Fine print: **By signing up you agree to our Terms of Service and Privacy Policy.**

**Behavior**

- Validate email format; password min 8 chars
- Sign Up → Clerk signUp → `07` if verification required else `08`
- Google → Clerk OAuth → `08`
- Log in → `06`
- Terms / Privacy → in-app WebView or `/settings` legal URLs

---

## 06 — Log in

**File:** `06-log-in.png`

**UI**

- Hero photo of monstera leaf
- Overline **WELCOME BACK**
- Title **Good to see you again**
- EMAIL + PASSWORD (eye toggle)
- Strength bar may appear while typing a new password on this screen in the mock; on login it is optional — **implement strength only on sign-up** unless Clerk reset uses this layout
- Link **Forgot password?** (forest green, right aligned)
- Primary **Log In**
- Outline Google button
- **New here? Sign up**

**Behavior**

- Log In → Clerk signIn → `08` or `07`
- Forgot password → Clerk reset email flow (can reuse `07` with copy “Check your email”)
- Sign up → `05`

---

## 07 — Verify email

**File:** `07-verify-email.png`

**UI**

- Back
- Green circle with envelope + check
- Title **Check your email**
- Body: **Enter the 6-digit code we sent to** + bold email
- Six boxes; filled digits; active box has green ring
- **Resend code in 0:12** (countdown mm:ss). When 0, become tappable **Resend code**
- **Wrong address? Go back and edit your email.**
- Bottom primary **Verify** (disabled until 6 digits)

**Behavior**

- Auto-advance focus between boxes; support paste of 6 digits
- Verify → Clerk attempt → `08` on success; inline error on fail
- Back returns to sign-up with email preserved

---

## 08 — Home / Today

**File:** `08-home-today.png`  
**Toast variant:** `27-state-success-toast.png`

**UI**

- Overline date e.g. **TUESDAY, 14 MARCH**
- Greeting **Good morning, {firstName}** + leaf emoji
- Bell (notifications / reminders) and circular avatar → Profile
- Mint card: circular water progress + **N plants need water today** + sentence listing due names and overdue, e.g. **Monty and Pearl are due · Ficus is 2 days late**
- Section **Today's care** + streak chip **7-day streak**
- Rows: photo, nickname, species, status pill, round water-action button
  - Due today: blue outline pill **Due today**
  - Overdue: coral outline on **card** + coral pill **Overdue 2d**
- Section **Upcoming** + **See all**
  - Compact rows: photo, nickname, location/species, **in N days**

**Behavior**

- Water button → mark watered, remove from today’s care or show done, toast **{name} watered**
- Row tap → plant detail `15`
- See all → Reminders or filtered My Plants
- Bell → `18`
- Avatar → `21`
- Greeting time-of-day: morning / afternoon / evening

**Empty:** If no plants, reuse reminders-empty illustration pattern with **Add a plant** (not shown in 08 PNG but required).

---

## 09 — Scan camera

**File:** `09-scan-camera.png`

**UI**

- Live camera, dimmed outside rounded square frame with L-shaped green corners
- Close (X) top-left; flip-camera top-right
- Caption **Center the leaf in the frame**
- Bottom: gallery thumbnail (last image) · large white shutter · flash button

**Behavior**

- Close → previous tab
- Gallery → image picker → `10`
- Shutter → capture → `10`
- Flash torch toggle
- Flip front/back
- If permission not granted → `24` instead of live camera

---

## 10 — Identifying

**File:** `10-identifying.png`

**UI**

- Blurred photo background
- Bottom sheet:
  - Green spinner
  - **Identifying your plant...**
  - **Matching leaf shape, texture and vein pattern**
  - Thumbnail of framed leaf
  - Progress bar
  - **Found N possible matches so far** (animate N 1→3)
  - **Cancel**

**Behavior**

- Cancel aborts fetch, returns to `09`
- On success with high score → `11`
- On success with low score → `12`
- On network/API failure → `25`

---

## 11 — Scan result (high confidence)

**File:** `11-scan-result.png`

**UI**

- Hero photo, back chevron
- Sheet:
  - Title species **Monstera deliciosa**
  - Scientific subtitle
  - Chip **94% match** with droplet
  - Three care tiles: Water every N days · Light · Difficulty
  - **Not right? Other matches** → horizontal cards with % (e.g. Monstera adansonii 84%, Epipremnum aureum 61%)
  - Primary **Add to My Plants**
  - Outline **Retake photo**

**Behavior**

- Other match tap replaces selected species + care tiles
- Add → `13` with species/photo/interval prefilled
- Retake → `09`

Use threshold **top suggestion ≥ 80%** for this screen.

---

## 12 — Low confidence

**File:** `12-low-confidence.png`

**UI**

- Back
- Icon: leaf + magnifier + `?`
- **We’re not quite sure**
- **The photo was a little dark or blurry. Try again in even daylight and fill the frame with a single leaf.**
- Tip card: **Best results: natural light, leaf flat and centred, no other plants in frame.**
- **POSSIBLE MATCHES** list: thumbnail, name, “Likely houseplant”, % (58%, 41%, …)
- Sticky **Retake photo**
- Outline **Search manually**

**Behavior**

- Match row → treat as selected species → `13` (or `11` with that species)
- Retake → `09`
- Search manually → species search modal (query local/curated species table or Plant.id text search). Not a web scrape UI.

---

## 13 — Add plant

**File:** `13-add-plant.png`

**UI**

- Back · **Add plant** · subtitle **Confirm the details**
- Hero photo, species chip, camera button to replace photo
- **NICKNAME** leaf icon (e.g. Monty)
- **LOCATION** chips: Living room (selected), Bedroom, Kitchen, Office, **+ Custom**
- **LAST WATERED** date field (e.g. Mar 8, 2026)
- **WATERING SCHEDULE** + **Recommended** badge
- Stepper − / **7 days** / +
- Primary **Save Plant**

**Behavior**

- Custom location → text prompt, new chip
- Stepper 1–30 days
- Save → insert plant, schedule reminder, navigate `15` or `14`
- Camera on hero → recapture without losing form

---

## 14 — My Plants

**File:** `14-my-plants.png`

**UI**

- Title **My Plants** + count badge **6** + search icon
- Horizontal filters: **All** (filled), Due today, Living room, Bedroom, …
- 2-column cards: photo, nickname, species, status
  - Due today water icon + copy
  - Overdue coral border + **Overdue 2d**
  - Future **in 6 days**
- Green **+** FAB above tab bar

**Behavior**

- Filters intersect search query
- Card → `15`
- Search → filter nicknames/species
- + → `09` (identify) or action sheet: Scan vs Add without ID (optional). Default **+ opens scan** to match product story.
- Tab My Plants selected

---

## 15 — Plant detail

**File:** `15-plant-detail.png`

**UI**

- Full-width photo, back, overflow **···**
- Name **Monty**, species *Monstera deliciosa*, location chip **Living room**
- Next-watering card: ring **2 days**, **Next watering in 2 days**, **Scheduled for Thursday, Mar 16 · 8:00 AM**
- Primary **Mark as watered**
- Stats row: **Mar 8 Last watered** · **7 days Every** · streak **7 wks**
- Tabs **Care | History | Notes** (Care selected)
- Care cards e.g. **Light** — Bright indirect — 2 m from a south-facing window…

**Behavior**

- Mark as watered → toast, ring resets to full interval
- Every / schedule area → open `16`
- History tab → `17` or embedded log
- Notes tab → editable notes
- ··· → edit details, change photo, delete
- Location chip may open location picker

---

## 16 — Edit schedule (sheet)

**File:** `16-edit-schedule.png`

**UI**

- Bottom sheet over dimmed detail
- Grabber, **Watering schedule**, plant subtitle, close X
- Large − / **7 days** / +
- **Reset to recommended**
- Row **Reminder time** · **8:00 AM**
- **Save**
- **Delete plant** coral

**Behavior**

- Save updates interval + reminder time, reschedules notifications
- Reset restores species default interval
- Delete → confirm then pop to My Plants
- Time picker for reminder

---

## 17 — Care log

**File:** `17-care-log.png`

**UI**

- Back · **Care log** · month subtitle
- Calendar **March 2026** with prev/next
- Dots: green watered, coral missed, pale no data; selected day filled green (14)
- Legend
- Mint summary: **12 waterings this month** · **3 more than February · 2 missed days**
- **RECENT ACTIVITY** rows: thumbnail, **Watered · 250 ml · Monty**, timestamp

**Behavior**

- Can be per-plant or household. Screenshot is household feed + month stats — **implement as user-wide care log** reachable from Profile or plant History. Plant History filters to that plant.
- Day tap filters activity
- Units follow Settings (250 ml vs oz)

---

## 18 — Reminders (populated)

**File:** `18-reminders.png`

**UI**

- **Reminders** + gear → `20`
- Segmented **Upcoming** | Completed
- Groups **TODAY** / **TOMORROW** / **THIS WEEK** with task counts
- Rows: photo, **Water {name}**, clock + time
- Swipe or tap reveals **Done** (green) and **Snooze** (blue) as on Pearl row
- Tab Reminders selected

**Behavior**

- Done = mark watered
- Snooze uses Notification settings duration
- Completed segment lists done items for the day
- Row tap → plant detail

---

## 19 — Reminders empty

**File:** `19-reminders-empty.png`

**UI**

- Same chrome
- Sleeping plant in mint circle with Zzz
- **No reminders yet**
- **Add a plant and LeafCare will build a watering schedule and remind you right on time.**
- **Add a plant** → scan/`13`

---

## 20 — Notification settings

**File:** `20-notification-settings.png`

**UI**

- Back · **Notifications** · **Watering reminders and nudges**
- Banner if on a streak: **You’re on a 7-day streak — your reminders are on time. Keep it up.**
- Toggle **Watering reminders**
- Section **TIMING**
  - **Daily reminder time** · value chip **9:00 AM**
  - **Snooze duration** segmented **1h | 3h | Tomorrow** (3h selected)
  - **Overdue nudges** toggle
- Footer: **Reminders arrive in your local time. Quiet hours are 10:00 PM – 7:00 AM.**

**Behavior**

- Persist on `notification_prefs`
- Quiet hours: do not send pushes in that window; shift to 7:00 AM
- Daily digest lists plants due that day

---

## 21 — Profile

**File:** `21-profile.png`

**UI**

- **Profile** + gear → `22`
- Avatar, **Alex Morgan**, email
- Stats: **6 Total plants** · **7d Current streak** · **148 Waterings**
- **Achievements** · **2 of 4 unlocked**
  - Unlocked: First plant, 7-day streak
  - Locked: 10 plants (lock icon)
- Rows: Edit profile, Notification settings, Privacy, Help & support
- **Log out** coral with icon
- Tab bar Profile selected

**Behavior**

- Edit profile → name/avatar sheet
- Privacy → privacy policy + photo handling copy (“Photos stay on your device unless you choose to save them.”)
- Help → support email
- Log out → Clerk signOut → `06`

**Achievements (v1)**

| Badge | Unlock |
| --- | --- |
| First plant | plants ≥ 1 |
| 7-day streak | streak_days ≥ 7 |
| 10 plants | plants ≥ 10 |
| 30-day streak (4th) | streak_days ≥ 30 |

---

## 22 — Settings / account

**File:** `22-settings-account.png`

**UI**

- Back · **Settings** · **Account and preferences**
- **ACCOUNT**: Email row; Change password + **Last changed 3 months ago**
- **PREFERENCES**: Theme segmented **Light | System | Dark** (Light is the shipped default; the mock shows System selected); Units **Metric | Imperial**
- **ABOUT**: Version **1.2.0(248)** (ship real version from app config), Terms, Privacy
- **Danger zone** coral card: deleting account removes plants, streaks, etc.

**Behavior**

- Email row may be read-only (Clerk)
- Change password → Clerk
- Theme stored locally + profile
- Units convert care log volumes and any temperature copy
- Danger zone → `23`

---

## 23 — Delete account confirm

**File:** `23-settings-delete-confirm.png`

**UI**

- Modal over dimmed settings
- Warning icon
- **Delete account?**
- **This permanently deletes your {n} plants, care history and streaks. This action cannot be undone.**
- **Cancel** outline · **Delete** coral filled

**Behavior**

- Delete → API wipe user data + Clerk delete → `05`
- Cancel dismisses

---

## 24 — Camera permission

**File:** `24-state-camera-permission.png`

**UI**

- Illustration: leaf in scan frame + camera shutter
- **Allow camera access**
- **LeafCare uses your camera to identify plants. Photos stay on your device unless you choose to save them.**
- **Allow camera**
- Text button **Not now**

**Behavior**

- Allow → system permission; if granted `09`, if denied show OS settings deep-link
- Not now → back to tabs

---

## 25 — Error

**File:** `25-state-error.png`

**UI**

- Sad cracked pot illustration
- **Something went wrong**
- **We couldn’t reach LeafCare. Check your connection and try again — your plants are safe.**
- **Try again**
- **Contact support**

**Behavior**

- Try again retries last failed action
- Contact support opens mail to `EXPO_PUBLIC_SUPPORT_EMAIL`

Use for identify/API/auth hard failures, not for validation errors.

---

## 26 — Loading & offline

**File:** `26-state-loading-offline.png`

**UI**

- Pink top banner **No connection**
- Home-like layout with **skeleton** blocks (no real text)

**Behavior**

- Show whenever `NetInfo` is offline
- Skeletons on Home/My Plants while first fetch
- Banner remains until connectivity returns, then refetch

---

## 27 — Success toast

**File:** `27-state-success-toast.png`

**UI**

- Dark green top toast: droplet + **Monty watered**
- Rests on Home content

**Behavior**

- Auto-dismiss ~3s
- Trigger: mark watered from Home, Detail, or Reminders Done

---

## Global navigation map

```
Splash → Onboarding → Sign up ⇄ Log in → Verify → Tabs
Tabs: Home | Plants | Scan FAB | Reminders | Profile
Scan FAB → Permission? → Camera → Identifying → Result or Uncertain → Add plant → Detail
Profile → Settings → Delete modal
Profile → Notification settings
Home water / Reminders Done → Toast
```

## Copy lock

Do not paraphrase screenshot strings. If a string is in a PNG, use it exactly (including the apostrophe in **We’re not quite sure** and the em dash in error copy).
