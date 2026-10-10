# Overview

## Product

LeafCare is a mobile application for people who own houseplants but cannot reliably name them or remember watering. The user photographs a leaf, the system identifies the species through an external plant-ID API, then creates a personal watering schedule and reminders.

Tagline from splash: **Know your plant. Keep it alive.**

## Problem

- Search engines require the species name first.
- Beginners overwater or underwater and lose plants.
- Existing apps are either expert-oriented or identification-only without a care loop.

## Solution loop

1. Capture or pick a leaf photo.
2. Identify species (confidence + alternatives).
3. Confirm nickname, room, last watered date, interval.
4. Save to My Plants.
5. Home and Reminders surface due / overdue work.
6. User marks watered → care log + streak.
7. Push digest and per-plant reminders keep the habit.

## Users

| Role | Need |
| --- | --- |
| Beginner plant owner | Identify + simple watering cadence |
| Hobbyist with several plants | Collection, rooms, history, streaks |
| Gift recipient | Fast ID and a schedule with no prior knowledge |

## Success metrics (product)

- Time from camera open to plant saved
- Identification acceptance vs retake / manual search
- Waterings logged on time vs missed (care log calendar)
- Streak retention (profile “current streak”)
- Reminder completion (Done vs Snooze)

## Canonical demo

The UI screenshots use **Alex Morgan** (`alex.morgan@leafcare.app`) with six plants. Implementations should be able to reproduce that dataset (see `database.md`).
