# MONARCHS EA Mobile League

The **MONARCHS EA Mobile League** is a WhatsApp-based football tournament that follows a **Premier League format**.  
Players compete in a round-robin style competition, earning points for wins and draws, with tie-breakers determining final standings.

## 📌 League Format

- **Format:** Premier League (Single Round Robin)
- **Scoring:** Win = 3 points, Draw = 1 point, Loss = 0 points
- **Tie-breakers:** Goal Difference → Goals Scored → Head-to-head record
- **Season Champion:** Player with the most points at the end of the season

## 📝 Registration

1. Post in the WhatsApp group:
2. Admins will confirm your registration and add you to the fixtures.
3. Registration closes before fixtures are released.

## 🎮 Match Rules

- Matches are played via EA Mobile.
- Both players must play before the match deadline.
- Only results submitted in the group by the admin supervising with **clear screenshots** will be counted.
- If a match cannot be completed, admins will decide based on evidence.

## 🤝 Fair Play

- Respect all players and admins.
- No cheating, glitching, or unsporting behavior.
- Repeated offenses may lead to disqualification.

## 📅 Season Flow

1. Registration
2. Fixture Release
3. Matches Played & Results Reported
4. Final Standings & Champion Announcement

---

## 🖥️ League Arena — the league manager app

The league is run with **League Arena**, a minimalist, installable web app that
creates leagues, generates the full round-robin schedule, tracks scores live and
keeps standings in sync — online and offline.

It has been rebuilt from a single 3,000-line `index.html` into a typed
**React + Vite** app with a proper **PWA** shell. The app lives in [`app/`](app):

| What | Where |
| --- | --- |
| **App (source)** | [`app/`](app) — React + TypeScript |
| **Run locally** | `cd app && npm install && npm run dev` |
| **Build** | `cd app && npm run build` → `app/dist` (deploy this folder) |
| **Docs** | [`app/README.md`](app/README.md) — architecture, parity table, tests, cloud schema |
| **Legacy app** | `index.html`, `manifest.json`, `sw.js` at the repo root (kept for reference) |

### Features

- **Create leagues** — 4–24 even teams, custom or shuffled names, winners and
  relegation zones highlighted on the table.
- **Full fixtures** — double round-robin, week-by-week scores, live standings.
- **Publish weeks** — admins choose which matchweeks visitors can see.
- **Cloud + offline** — Supabase accounts and snapshots, auto-sync after edits,
  localStorage fallback, backup/restore and season reset.
- **Installable PWA** — app-shell precache, home-screen install on Android,
  desktop and iOS, update prompt, offline indicator.

### Install it on a phone

Open the deployed app and choose **Install** (Android/desktop) or
**Share → Add to Home Screen** (iOS). It then launches full screen, works
offline, and keeps every score you enter on the device until it syncs.

---

**Organized by:** MONARCHS EA Mobile League WhatsApp Group  
**Contact:** Admins in the group for questions or disputes.
