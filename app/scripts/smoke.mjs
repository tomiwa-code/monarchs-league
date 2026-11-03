/**
 * Smoke test: boots the production bundle in jsdom and walks the main routes,
 * first as an anonymous visitor (sample season) and then as a signed-in admin
 * (score entry → live standings → persistence).
 *
 * Run after `npm run build`:
 *   node scripts/smoke.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
const asset = html.match(/src="([^"]*index-[^"]*\.js)"/)?.[1];
const css = html.match(/href="([^"]*index-[^"]*\.css)"/)?.[1];
if (!asset) throw new Error('could not find the bundled entry script');

const code = readFileSync(resolve(root, 'dist', asset.replace(/^\.\//, '')), 'utf8')
  // jsdom has no ES module support, so inline the single import.meta usage.
  .replace(/import\.meta\.url/g, '"https://league-arena.test/assets/index.js"');

const failures = [];
const check = (name, condition) => {
  if (!condition) failures.push(name);
  console.log(`${condition ? '✓' : '✗'} ${name}`);
};

/** Boots a clean jsdom instance with optional pre-seeded localStorage. */
async function boot(storage = {}) {
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), {
    url: 'https://league-arena.test/',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.matchMedia = () => ({
    matches: false,
    media: '',
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
  window.scrollTo = () => {};
  window.confirm = () => true;
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value);

  global.window = window;
  global.document = window.document;
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });

  window.eval(code);
  await settle(window, 400);

  return {
    window,
    document: window.document,
    text: () => window.document.body.textContent.replace(/\s+/g, ' '),
    async go(hash) {
      window.location.hash = hash;
      window.dispatchEvent(new window.HashChangeEvent('hashchange'));
      await settle(window, 250);
    },
    async click(element) {
      element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await settle(window, 250);
    },
  };
}

const settle = (window, ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

/* ── Scenario 1: anonymous visitor ──────────────────────────────────────── */
const visitor = await boot();
const { document } = visitor;
const page = visitor;

check('home hero renders', page.text().includes('Manage your football leagues'));
check('nav brand renders', !!document.querySelector('.navbar-brand'));
check('home action cards render', document.querySelectorAll('.home-action-card').length === 2);
check('feature grid renders', document.querySelectorAll('.feature-item').length === 3);
check('anonymous users get the sample season', page.text().includes('sample season'));

await page.go('#/leagues');
check('leagues page renders', page.text().includes('My Leagues'));
check('sample league card renders', document.querySelectorAll('.league-card').length === 1);

await page.click([...document.querySelectorAll('.action-btn')].find((b) => b.textContent.includes('View')));
check('league detail renders standings', !!document.querySelector('table.standings'));
check('all teams appear in the table', document.querySelectorAll('table.standings tbody tr').length === 16);
check(
  'winner/relegation zones are highlighted',
  document.querySelectorAll('tr.winner').length === 3 && document.querySelectorAll('tr.relegation').length === 3,
);
check('form badges render', document.querySelectorAll('.form-badge.win').length > 0);

await page.click([...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.includes('Fixtures')));
check('all 30 matchweeks render', document.querySelectorAll('.week-btn').length === 30);
check('fixture cards render', document.querySelectorAll('.fixture-card').length === 8);
check('scores are read-only for visitors', document.querySelectorAll('.score-input').length === 0);
check('weeks beyond the published range are locked', document.querySelectorAll('.week-btn:disabled').length > 0);

await page.go('#/create');
check('create route is admin-gated', !document.querySelector('.form-card'));

/* ── Scenario 2: signed-in admin editing scores ─────────────────────────── */
const admin = await boot({
  leagueArenaAdmin: JSON.stringify({ isAdmin: true, username: 'admin', accessCode: 'secret' }),
  leagueArenaData_admin: JSON.stringify([
    {
      id: 4242,
      name: 'Test League',
      teams: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
      winnersCount: 1,
      relegationCount: 1,
      publicVisibleWeekStart: 1,
      publicVisibleWeekEnd: 6,
    },
  ]),
});

check('admin badge shows when logged in', !!admin.document.querySelector('.admin-badge'));
await admin.go('#/league/4242');
check('admin league view renders', admin.text().includes('Test League'));
check('admin sees edit/backup actions', admin.document.querySelectorAll('.action-buttons .btn').length === 4);

const fixturesBtn = [...admin.document.querySelectorAll('.tab-btn')].find((b) => b.textContent.includes('Fixtures'));
await admin.click(fixturesBtn);
const inputs = admin.document.querySelectorAll('.score-input');
check('admin gets editable score inputs', inputs.length === 4);

const setValue = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(admin.window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new admin.window.Event('input', { bubbles: true }));
};
setValue(inputs[0], '3');
setValue(inputs[1], '1');
await settle(admin.window, 150);
const storedAfterTyping = JSON.parse(admin.window.localStorage.getItem('leagueArenaData_admin'));

await admin.click([...admin.document.querySelectorAll('.tab-btn')].find((b) => b.textContent.includes('Table')));
const topRow = admin.document.querySelector('table.standings tbody tr');
check(
  'typing a score updates the standings immediately',
  topRow.textContent.includes('3') && topRow.classList.contains('winner'),
);

const stored = storedAfterTyping;
check('score is persisted locally', stored[0].fixtures[0].homeScore === 3);
check('standings are persisted too', stored[0].table.some((t) => t.points === 3));

await admin.go('#/create');
check('admin can open the create form', !!admin.document.querySelector('.form-card'));
const nameInput = admin.document.getElementById('league-name');
setValue(nameInput, 'Fresh Season');
const form = admin.document.querySelector('form.form-card');
form.dispatchEvent(new admin.window.Event('submit', { bubbles: true, cancelable: true }));
await settle(admin.window, 250);
check('creating a league opens its detail page', admin.text().includes('Fresh Season'));

/* ── Scenario 3: PWA artefacts ──────────────────────────────────────────── */
check('manifest is emitted', existsSync(resolve(root, 'dist/manifest.webmanifest')));
check('service worker is emitted', existsSync(resolve(root, 'dist/sw.js')));
check('css bundle is emitted', !!css);
const manifest = JSON.parse(readFileSync(resolve(root, 'dist/manifest.webmanifest'), 'utf8'));
check('manifest is standalone + themed', manifest.display === 'standalone' && manifest.theme_color === '#0b1120');
check('manifest declares 192/512/maskable icons', manifest.icons.length >= 3 && manifest.icons.some((i) => i.purpose === 'maskable'));
check('service worker precaches the app shell', readFileSync(resolve(root, 'dist/sw.js'), 'utf8').includes('index.html'));

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
