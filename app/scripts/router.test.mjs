/** Router parsing/formatting tests: node --experimental-strip-types --test scripts/router.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routeToHash } from '../src/lib/router.ts';

test('parses each route shape', () => {
  assert.deepEqual(parseRoute(''), { name: 'home' });
  assert.deepEqual(parseRoute('#/'), { name: 'home' });
  assert.deepEqual(parseRoute('#/create'), { name: 'create' });
  assert.deepEqual(parseRoute('#/leagues'), { name: 'leagues' });
  assert.deepEqual(parseRoute('#/leagues?user=ada'), { name: 'leagues', user: 'ada' });
  assert.deepEqual(parseRoute('#/league/123'), { name: 'league', id: 123 });
});

test('rejects malformed ids and falls back safely', () => {
  assert.deepEqual(parseRoute('#/league/abc'), { name: 'leagues' });
  assert.deepEqual(parseRoute('#/league/-3'), { name: 'leagues' });
  assert.deepEqual(parseRoute('#/nope'), { name: 'home' });
});

test('round-trips through routeToHash', () => {
  const routes = [
    { name: 'home' },
    { name: 'create' },
    { name: 'leagues' },
    { name: 'leagues', user: 'ada lovelace' },
    { name: 'league', id: 42 },
  ];
  for (const route of routes) {
    assert.deepEqual(parseRoute(routeToHash(route)), route);
  }
});
