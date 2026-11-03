/**
 * Domain tests. Run with: node --experimental-strip-types --test scripts/league.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLeague,
  createDemoLeague,
  ensureUniqueFixtureIds,
  generateFixtures,
  normalizeLeague,
  recalculateTable,
  sortTable,
  standings,
  totalWeeks,
} from '../src/lib/league.ts';

const teams = (n) => Array.from({ length: n }, (_, i) => `Team ${i + 1}`);

test('round robin: every team plays every other team twice', () => {
  for (const size of [4, 6, 10, 20, 24]) {
    const list = teams(size);
    const fixtures = generateFixtures(list);
    assert.equal(fixtures.length, (size * (size - 1)) / 2 * 2, `fixture count for ${size} teams`);
    assert.equal(totalWeeks(size), (size - 1) * 2);

    const pairs = new Map();
    for (const f of fixtures) {
      assert.notEqual(f.home, f.away, 'a team never plays itself');
      const key = `${f.home}|${f.away}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    assert.equal(pairs.size, size * (size - 1), `unique ordered pairs for ${size} teams`);
    for (const count of pairs.values()) assert.equal(count, 1);

    // every team plays exactly once per week
    const weeks = new Map();
    for (const f of fixtures) {
      weeks.set(f.week, (weeks.get(f.week) ?? 0) + 1);
    }
    assert.equal(weeks.size, totalWeeks(size));
    for (const count of weeks.values()) assert.equal(count, size / 2);
  }
});

test('fixture ids are unique even when generated in the same millisecond', () => {
  const league = buildLeague({
    name: 'Dupe check',
    teams: teams(20),
    winnersCount: 1,
    relegationCount: 3,
    distribution: 'custom',
  });
  const ids = new Set(league.fixtures.map((f) => f.id));
  assert.equal(ids.size, league.fixtures.length);

  // simulate legacy corrupted data
  league.fixtures.forEach((f) => {
    f.id = 1;
  });
  assert.equal(ensureUniqueFixtureIds(league), true);
  assert.equal(new Set(league.fixtures.map((f) => f.id)).size, league.fixtures.length);
});

test('standings points, goal difference and form are correct', () => {
  const league = buildLeague({
    name: 'Mini',
    teams: ['A', 'B', 'C', 'D'],
    winnersCount: 1,
    relegationCount: 1,
    distribution: 'custom',
  });

  const setResult = (home, away, hs, as) => {
    const fixture = league.fixtures.find((f) => f.home === home && f.away === away);
    assert.ok(fixture, `${home} vs ${away} exists`);
    fixture.homeScore = hs;
    fixture.awayScore = as;
  };

  setResult('A', 'B', 2, 0); // A win
  setResult('C', 'D', 1, 1); // draw

  const table = recalculateTable(league);
  const a = table.find((t) => t.name === 'A');
  const b = table.find((t) => t.name === 'B');
  const c = table.find((t) => t.name === 'C');

  assert.deepEqual(
    { p: a.played, w: a.wins, pts: a.points, gd: a.gd, form: a.form },
    { p: 1, w: 1, pts: 3, gd: 2, form: ['W'] },
  );
  assert.deepEqual({ pts: b.points, l: b.losses, gd: b.gd, form: b.form }, { pts: 0, l: 1, gd: -2, form: ['L'] });
  assert.deepEqual({ pts: c.points, d: c.draws, form: c.form }, { pts: 1, d: 1, form: ['D'] });

  const ordered = sortTable(table);
  assert.deepEqual(ordered.map((t) => t.name).slice(0, 2), ['A', 'C']);
});

test('unplayed fixtures never count towards the table', () => {
  const league = buildLeague({
    name: 'Empty',
    teams: teams(8),
    winnersCount: 2,
    relegationCount: 2,
    distribution: 'custom',
  });
  assert.equal(standings(league).every((t) => t.played === 0 && t.points === 0), true);
});

test('normalizeLeague repairs legacy data', () => {
  const legacy = normalizeLeague({
    name: 'Legacy',
    teams: ['X', 'Y', 'Z', 'W'],
    fixtures: [
      { home: 'X', away: 'Y', homeScore: '3', awayScore: '0', week: 1 },
      { home: 'Y', away: 'X', homeScore: '', awayScore: '1', week: 4 },
    ],
  });
  assert.equal(legacy.fixtures[0].homeScore, 3);
  assert.equal(legacy.fixtures[0].awayScore, 0);
  assert.equal(legacy.fixtures[1].homeScore, null);
  assert.equal(legacy.fixtures[1].awayScore, 1);
  assert.equal(legacy.publicVisibleWeekEnd, 6);
  assert.equal(new Set(legacy.fixtures.map((f) => f.id)).size, 2);
  assert.equal(legacy.table.find((t) => t.name === 'X').points, 3);
});

test('demo league is stable and plausible', () => {
  const demo = createDemoLeague();
  assert.equal(demo.teams.length, 16);
  assert.ok(demo.table.some((t) => t.played > 0));
  assert.equal(demo.table.reduce((sum, t) => sum + t.points, 0) > 0, true);
  const goals = demo.table.reduce((sum, t) => sum + t.gf, 0);
  const against = demo.table.reduce((sum, t) => sum + t.ga, 0);
  assert.equal(goals, against, 'every goal scored is a goal conceded');
});
