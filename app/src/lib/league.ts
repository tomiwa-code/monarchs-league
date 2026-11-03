/**
 * League Arena — pure domain logic.
 * Fixture generation (double round robin), standings recalculation, sorting and
 * data normalisation. No DOM, no network: everything here is unit-testable.
 */

export type FormResult = 'W' | 'D' | 'L';

export interface Fixture {
  id: number;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  week: number;
}

export interface TeamRow {
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: FormResult[];
}

export interface League {
  id: number;
  name: string;
  teams: string[];
  fixtures: Fixture[];
  table: TeamRow[];
  distribution: 'custom' | 'random';
  winnersCount: number;
  relegationCount: number;
  publicVisibleWeekStart: number;
  publicVisibleWeekEnd: number;
}

export const MAX_TEAMS = 24;
export const MIN_TEAMS = 4;

/* ── Fixture ids ─────────────────────────────────────────────────────────
 * The original app used Date.now() + Math.random(), which collides when a
 * whole season of fixtures is built in the same millisecond — duplicate ids
 * make find() return the wrong fixture when scores are typed in. A strictly
 * monotonic counter has no such failure mode.
 */
let fixtureIdSeq = Date.now() * 1000;

export function nextFixtureId(): number {
  fixtureIdSeq += 1;
  return fixtureIdSeq;
}

/** Repairs duplicate/missing fixture ids in place. Returns true if changed. */
export function ensureUniqueFixtureIds(league: League): boolean {
  if (!Array.isArray(league.fixtures)) return false;
  let maxId = 0;
  for (const f of league.fixtures) {
    const n = Number(f.id);
    if (Number.isFinite(n) && n > maxId) maxId = n;
  }
  if (maxId >= fixtureIdSeq) fixtureIdSeq = maxId + 1;

  const seen = new Set<number>();
  let changed = false;
  for (const f of league.fixtures) {
    if (f.id === undefined || f.id === null || seen.has(f.id)) {
      f.id = nextFixtureId();
      changed = true;
    }
    seen.add(f.id);
  }
  return changed;
}

/* ── Fixtures ───────────────────────────────────────────────────────────── */

/**
 * Round-robin schedule using the circle method, then the reverse fixtures as
 * the second half of the season. Every team plays every other team exactly
 * twice — once at home, once away — and never plays itself.
 */
export function generateFixtures(teams: string[]): Fixture[] {
  const list = [...teams];
  if (list.length % 2 !== 0) list.push('BYE');

  const n = list.length;
  const rounds = n - 1;
  const half = n / 2;
  const firstHalf: Fixture[] = [];

  // Fixed competitor plus rotating ring.
  let ring = list.slice(1);
  for (let round = 0; round < rounds; round++) {
    const week = round + 1;
    const opponents = [list[0], ...ring];
    for (let i = 0; i < half; i++) {
      const home = opponents[i];
      const away = opponents[n - 1 - i];
      if (home === 'BYE' || away === 'BYE') continue;
      // Alternate home/away by round so the same side doesn't always host.
      const flip = round % 2 === 1;
      firstHalf.push({
        id: nextFixtureId(),
        home: flip ? away : home,
        away: flip ? home : away,
        homeScore: null,
        awayScore: null,
        week,
      });
    }
    ring = [ring[ring.length - 1], ...ring.slice(0, ring.length - 1)];
  }

  const secondHalf: Fixture[] = firstHalf.map((f) => ({
    id: nextFixtureId(),
    home: f.away,
    away: f.home,
    homeScore: null,
    awayScore: null,
    week: f.week + rounds,
  }));

  return [...firstHalf, ...secondHalf];
}

export const totalWeeks = (teamCount: number): number => Math.max(0, (teamCount - 1) * 2);

/* ── Standings ──────────────────────────────────────────────────────────── */

export function emptyTable(teams: string[]): TeamRow[] {
  return teams.map((name) => ({
    name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    form: [],
  }));
}

export function recalculateTable(league: Pick<League, 'teams' | 'fixtures'>): TeamRow[] {
  const table = emptyTable(league.teams);
  const byName = new Map(table.map((row) => [row.name, row]));

  const played = [...league.fixtures]
    .filter((f) => f.homeScore !== null && f.awayScore !== null)
    .sort((a, b) => a.week - b.week);

  for (const fix of played) {
    const home = byName.get(fix.home);
    const away = byName.get(fix.away);
    if (!home || !away || home === away) continue;

    const hs = Number(fix.homeScore);
    const as = Number(fix.awayScore);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;

    home.played += 1;
    away.played += 1;
    home.gf += hs;
    home.ga += as;
    away.gf += as;
    away.ga += hs;

    if (hs > as) {
      home.wins += 1;
      home.points += 3;
      home.form.push('W');
      away.losses += 1;
      away.form.push('L');
    } else if (hs < as) {
      away.wins += 1;
      away.points += 3;
      away.form.push('W');
      home.losses += 1;
      home.form.push('L');
    } else {
      home.draws += 1;
      home.points += 1;
      home.form.push('D');
      away.draws += 1;
      away.points += 1;
      away.form.push('D');
    }
  }

  for (const row of table) {
    row.gd = row.gf - row.ga;
    row.form = row.form.slice(-5);
  }
  return table;
}

/** Points → goal difference → goals scored → name. */
export function sortTable(table: TeamRow[]): TeamRow[] {
  return [...table].sort(
    (a, b) =>
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.name.localeCompare(b.name),
  );
}

export function standings(league: League): TeamRow[] {
  return sortTable(league.table?.length ? league.table : recalculateTable(league));
}

/* ── Normalisation ──────────────────────────────────────────────────────── */

export interface LeagueSeed {
  id?: number;
  name?: string;
  teams: string[];
  fixtures?: Fixture[];
  distribution?: 'custom' | 'random';
  winnersCount?: number;
  relegationCount?: number;
  publicVisibleWeekStart?: number;
  publicVisibleWeekEnd?: number;
}

/** Brings any persisted/cloud league up to the current shape. */
export function normalizeLeague(input: LeagueSeed | League): League {
  const teams = Array.isArray(input.teams)
    ? input.teams.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const league: League = {
    id: Number(input.id) || Date.now() + Math.floor(Math.random() * 1000),
    name: String(input.name ?? 'Untitled League').trim() || 'Untitled League',
    teams,
    fixtures: Array.isArray(input.fixtures) ? input.fixtures : [],
    table: [],
    distribution: input.distribution === 'random' ? 'random' : 'custom',
    winnersCount: clampInt(input.winnersCount ?? 1, 0, 10),
    relegationCount: clampInt(input.relegationCount ?? 3, 0, 10),
    publicVisibleWeekStart: Math.max(1, Number(input.publicVisibleWeekStart) || 1),
    publicVisibleWeekEnd: 0,
  };

  const weeks = totalWeeks(teams.length);
  league.publicVisibleWeekEnd = clampInt(input.publicVisibleWeekEnd ?? weeks, 1, Math.max(1, weeks));
  if (league.publicVisibleWeekStart > league.publicVisibleWeekEnd) {
    league.publicVisibleWeekStart = 1;
    league.publicVisibleWeekEnd = Math.max(1, weeks);
  }

  const toScore = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  // A league always needs a schedule: legacy/partial backups may lack one.
  if (league.fixtures.length === 0 && teams.length >= 2) {
    league.fixtures = generateFixtures(teams);
  }

  league.fixtures = league.fixtures.map((f) => ({
    id: Number(f.id),
    home: String(f.home),
    away: String(f.away),
    homeScore: toScore(f.homeScore),
    awayScore: toScore(f.awayScore),
    week: Number(f.week) || 1,
  }));

  ensureUniqueFixtureIds(league);
  league.table = recalculateTable(league);
  return league;
}

export function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Parses the "one per line" team-name textarea. */
export function parseTeamNames(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ── Creation helper ────────────────────────────────────────────────────── */

export interface CreateLeagueInput {
  name: string;
  teams: string[];
  winnersCount: number;
  relegationCount: number;
  distribution: 'custom' | 'random';
}

export function buildLeague({ name, teams, winnersCount, relegationCount, distribution }: CreateLeagueInput): League {
  const weeks = totalWeeks(teams.length);
  const league: League = {
    id: Date.now(),
    name: name.trim(),
    teams: [...teams],
    fixtures: generateFixtures(teams),
    table: [],
    distribution,
    winnersCount,
    relegationCount,
    publicVisibleWeekStart: 1,
    publicVisibleWeekEnd: Math.max(1, weeks),
  };
  league.table = recalculateTable(league);
  return league;
}

/* ── Demo league ────────────────────────────────────────────────────────── */

const DEMO_TEAMS = [
  'Arsenal',
  'Aston Villa',
  'Bournemouth',
  'Brentford',
  'Brighton',
  'Chelsea',
  'Crystal Palace',
  'Everton',
  'Fulham',
  'Liverpool',
  'Manchester City',
  'Manchester United',
  'Newcastle United',
  'Nottingham Forest',
  'Tottenham Hotspur',
  'West Ham United',
];

/**
 * A finished-looking sample season so the public (signed-out) view has
 * something to show. Scores are seeded pseudo-randomly but deterministically,
 * so the demo looks the same on every device.
 */
export function createDemoLeague(): League {
  const league = buildLeague({
    name: 'Monarchs EA League',
    teams: DEMO_TEAMS,
    winnersCount: 3,
    relegationCount: 3,
    distribution: 'custom',
  });

  let seed = 20260101;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const strength = new Map(DEMO_TEAMS.map((t, i) => [t, 1 - i / (DEMO_TEAMS.length + 2)]));

  for (const fixture of league.fixtures) {
    if (fixture.week > 10) continue; // season in progress
    const hs = Math.floor(rand() * 4 + strength.get(fixture.home)! * 2);
    const as = Math.floor(rand() * 4 + strength.get(fixture.away)! * 2);
    fixture.homeScore = Math.min(6, hs);
    fixture.awayScore = Math.min(6, as);
  }

  // Fixed id + date so deep links to the sample season survive a reload.
  league.id = 1735689600000;
  league.table = recalculateTable(league);
  league.publicVisibleWeekStart = 1;
  league.publicVisibleWeekEnd = 10;
  return league;
}
