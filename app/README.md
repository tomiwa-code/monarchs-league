# League Arena (v2)

A complete rebuild of the original single-file `index.html` League Arena CMS:
same layout, screens and behaviour, rewritten in **TypeScript + React + Vite**
and packaged as a real, installable **PWA**.

```
app/
├─ index.html               document shell (no CDN dependencies)
├─ src/
│  ├─ App.tsx               routing + app chrome (offline / update bars)
│  ├─ state/store.tsx       session, leagues, cloud sync, toasts
│  ├─ lib/
│  │  ├─ league.ts          fixtures, standings, normalisation (pure, tested)
│  │  ├─ cloud.ts           Supabase accounts, snapshots, load analytics
│  │  ├─ storage.ts         localStorage session + per-user league storage
│  │  └─ router.ts          tiny hash router (#/, #/leagues, #/league/:id)
│  ├─ pages/                Home · Create · Leagues · League detail
│  ├─ components/           navbar, standings, fixtures, modals, toasts
│  ├─ hooks/usePwa.ts       install prompt, offline state, SW updates
│  └─ styles.css            minimalist dark design system
├─ public/                  generated icons + favicon
└─ scripts/                 icon generator, domain tests, smoke test
```

## Getting started

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into app/dist
npm run preview  # serve the built PWA
```

## Testing

```bash
npm run build
node --experimental-strip-types --test scripts/league.test.mjs   # domain logic
node scripts/smoke.mjs                                           # full UI walk-through in jsdom
```

`league.test.mjs` verifies the round-robin generator (every team plays every
other team exactly twice, once per week, never itself), scoring and tie-breaks,
legacy-data repair and fixture-id uniqueness.

`smoke.mjs` boots the production bundle and walks the real app as a signed-out
visitor and as a signed-in admin — checking the sample season, standings,
fixture rendering, access control, live score entry, persistence, and that the
manifest/service worker are emitted.

## Parity with the original

| Original | Rebuild |
| --- | --- |
| Hash-less `showSection()` toggling | Deep-linkable routes (`#/league/123`) with the same screens |
| `createLeague`, `generateFixtures` | `buildLeague` / `generateFixtures` (circle method, home & away) |
| `recalculateTable` | `recalculateTable` + `sortTable` (pts → GD → GF → name) |
| Global `window.*` handlers | Context store, one writer per mutation |
| `innerHTML` templating | Typed React components with escaped values by default |
| Font Awesome + Chart.js CDNs | `lucide-react` icons + dependency-free CSS bar chart |
| Supabase signup/login/upload/load + load events | Same schema, wrapped in typed `Result` helpers |
| localStorage backup & restore | Same, plus per-league export and a season reset |
| `sw.js` cache-first for everything | Workbox precache of the app shell + network-first Supabase cache |

## Data model

```ts
League { id, name, teams[], fixtures[], table[], distribution,
         winnersCount, relegationCount,
         publicVisibleWeekStart, publicVisibleWeekEnd }
```

Stored under `leagueArenaData_<username>` (or `leagueArenaData_public` for
visitors) and mirrored to the Supabase `leagues`/`users`/`load_events` tables,
so existing cloud backups keep working.

## PWA

- `vite-plugin-pwa` generates the manifest and a Workbox service worker.
- The app shell is precached, so the installed app opens offline and every
  edit is kept on-device until you are back online.
- Home-screen install: prompt on Android/desktop, Share → “Add to Home Screen”
  instructions on iOS/iPadOS.
- Theme colour `#0b1120`, standalone display, `any` + `maskable` icons in
  `public/icons` (regenerate with `node scripts/generate-icons.mjs`).

## Cloud schema (unchanged)

```sql
create table users (
  username text primary key,
  access_code text not null
);

create table leagues (
  id bigint not null,
  username text not null,
  data jsonb not null,
  updated_at timestamptz default now(),
  primary key (id, username)
);

create table load_events (
  id bigserial primary key,
  username text not null,
  timestamp timestamptz default now()
);
```

> The app keeps the original trust model: the access code *is* the password and
> is stored as-is. Tighten with hashed credentials + row-level security before
> exposing it widely.
