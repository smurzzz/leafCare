# Contributing to LeafCare

## Before you start

1. Read [AGENTS.md](./AGENTS.md) and [docs/specification.md](./docs/specification.md).
2. Pick the next unchecked item in [docs/tasks.md](./docs/tasks.md) for the current phase in [docs/plan.md](./docs/plan.md).
3. Copy `.env.example` to `.env` / `.env.local`. Never commit secrets.

## How to work

- TypeScript only. No new JavaScript files in app or API.
- One feature per branch when git remotes exist (`feat/scan-camera`, `fix/overdue-badge`).
- Match screenshot copy and spacing. If the PNG and a markdown file disagree on **behavior**, markdown wins; if they disagree on **visuals**, the PNG wins.
- Run `npm test` (shared + API + the mobile Jest suite) and `npm run typecheck` before pushing. New
  pure logic in `apps/mobile/src/lib` or `src/theme` gets a test in the neighbouring `__tests__`.
- Update `docs/changelog.md` when a user-visible screen or API lands.
- If you add a table or endpoint, update `docs/database.md` or `docs/api.md` in the same change.

## Local toolchain (Phase 0+)

```bash
# Mobile
cd apps/mobile
npx expo start

# API
cd apps/api
npm run dev
```

Use Expo Go or a dev build. Camera identification needs a real device or a simulator with a photo from the library.

## Pull requests

Include: screen IDs touched (e.g. `08`, `15`), API routes, and a short test note (see `docs/testing.md`).
