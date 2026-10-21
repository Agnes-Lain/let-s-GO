#!/usr/bin/env node
// M5 item 4 web verification (spec docs/specs/M5-territory-counting.md §13).
//
// Exports the release web build, serves it and drives it in Chromium at 360×740: the map with
// Units 12–14 (24-*), territory squares in the explanation (25-*), the mark screen states
// (26-* … 32-*), the count entry pad on 7×7 and 9×9 (33-*, 34-* in en, fr, zh-CN), typed and
// revealed counting feedback (35-*, 36-*), a winner choice (37-*), the dead marker in the
// explanation (38-*) and regressions (39-*). Records hit areas, heights and contrast. Screenshots
// go to docs/screenshots/M5/ (only 24-* … 39-* are replaced). Exits non-zero on a failed check.
//
//   npm run verify:web:m5e              # always re-exports dist/ first
//   npm run verify:web:m5e -- --reuse   # reuse dist/ (must be a release export)
//
// Not part of Jest or CI: it needs a browser (CHROMIUM_PATH, PLAYWRIGHT_PATH as for M4).

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'docs', 'screenshots', 'M5');
const CLOUD_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROMIUM =
  process.env.CHROMIUM_PATH ?? (fs.existsSync(CLOUD_CHROMIUM) ? CLOUD_CHROMIUM : undefined);
const VIEWPORT = { width: 360, height: 740 };
const COLUMNS = 'abcdefghjklmnopqrst'; // lesson notation, no "i"
const LOCALES = ['en', 'fr', 'zh-CN'];
const FLASH_MS = 700;

function strings(locale) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'i18n', `${locale}.json`), 'utf8'));
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    'playwright',
    'playwright-core',
    (() => {
      try {
        return path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright');
      } catch {
        return undefined;
      }
    })(),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try the next one
    }
  }
  throw new Error('Playwright not found. Install it globally or set PLAYWRIGHT_PATH.');
}

function exportWeb() {
  if (process.argv.includes('--reuse') && fs.existsSync(path.join(DIST, 'index.html'))) {
    console.log('Reusing dist/.');
    return;
  }
  console.log('Exporting the release web build (no sample lesson)…');
  const result = spawnSync('npx', ['expo', 'export', '--platform', 'web'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, EXPO_OFFLINE: '1', CI: '1' },
  });
  if (result.status !== 0) throw new Error('expo export failed');
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

function serve() {
  const server = http.createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html');
    }
    res.setHeader('content-type', MIME[path.extname(file)] ?? 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const failures = [];
const consoleErrors = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

/** Touch-down + touch-up on a vertex (margin 1 cell with coordinates, 0.6 without). */
async function tap(page, vertex, size = 5, coordinates = true) {
  const box = await page.getByTestId('practice-board').last().boundingBox();
  const margin = coordinates ? 1 : 0.6;
  const cell = box.width / (size - 1 + 2 * margin);
  const x = box.x + (margin + COLUMNS.indexOf(vertex[0])) * cell;
  const y = box.y + (margin + size - Number(vertex.slice(1))) * cell;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(120);
}

async function press(page, testId) {
  await page.getByTestId(testId).last().click();
  await page.waitForTimeout(250);
}

/** The page does not scroll and every listed control is inside the 740 px viewport (AC 29, 43). */
async function fits(page, where, controls) {
  const { width, height } = await page.evaluate(() => ({
    width: document.scrollingElement.scrollWidth,
    height: document.scrollingElement.scrollHeight,
  }));
  check(
    `${where}: no page scroll`,
    width <= VIEWPORT.width && height <= VIEWPORT.height,
    `${width}×${height}`,
  );
  for (const id of controls) {
    const box = await page.getByTestId(id).last().boundingBox();
    const ok = box !== null && box.y >= 0 && box.y + box.height <= VIEWPORT.height + 0.5;
    check(`${where}: ${id} on screen`, ok, box ? `bottom ${(box.y + box.height).toFixed(0)}` : '');
  }
}

const LESSON_IDS = [
  'u01-board',
  'u02-liberties',
  'u03-connection',
  'u04-capture',
  'u05-atari',
  'u05-review',
  'u06-capture-go',
  'u06-checkpoint',
  'u07-forbidden',
  'u08-ko',
  'u09-ladder',
  'u09-review',
  'u10-eyes',
  'u11-two-eyes',
  'u11-vital',
  'u11-review',
  'u12-territory',
  'u13-counting',
  'u14-end',
];

/** 1★ on every lesson up to u14-end: every node of the map is open. */
function progress() {
  const entry = {
    stars: 1,
    plays: 1,
    bestClean: 4,
    bestSolved: 4,
    total: 7,
    lastPlayedAt: '2026-10-21T00:00:00.000Z',
  };
  return JSON.stringify({ v: 1, lessons: Object.fromEntries(LESSON_IDS.map((id) => [id, entry])) });
}

async function newPage(browser, locale) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale });
  await context.addInitScript(
    (value) => window.localStorage.setItem('progress', value),
    progress(),
  );
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`[${locale}] ${m.text()}`));
  page.on('pageerror', (e) => consoleErrors.push(`[${locale}] pageerror ${e.message}`));
  return { context, page };
}

async function openPractice(page, base, id) {
  await page.goto(`${base}/practice/${id}`);
  await page.getByTestId('practice-board').waitFor({ timeout: 30000 });
  await page.waitForTimeout(400);
}

const wait = (page, ms) => page.waitForTimeout(ms);
const text = async (page, id) =>
  (await page.getByTestId(id).last().innerText()).replace(/\n/g, ' ');
const count = async (page, id) => page.getByTestId(id).count();
const fill = (template, params) =>
  Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, String(v)), template);

async function mark(page, vertices, size = 5) {
  for (const v of vertices) await tap(page, v, size);
}
async function type(page, digits) {
  for (const d of String(digits)) await press(page, `practice-key-${d}`);
}
async function clearEntry(page) {
  for (let i = 0; i < 2; i++) {
    if (await page.getByTestId('practice-count-backspace').last().isEnabled()) {
      await press(page, 'practice-count-backspace');
    }
  }
}

/** Width and height of an element; checks ≥ 44 × 44 (AC 54). */
async function hitArea(page, where, id) {
  const box = await page.getByTestId(id).last().boundingBox();
  const ok = box !== null && box.width >= 44 - 0.5 && box.height >= 44 - 0.5;
  check(
    `${where}: ${id} ≥ 44×44`,
    ok,
    box ? `${box.width.toFixed(0)}×${box.height.toFixed(0)}` : 'missing',
  );
}

async function boardIs328(page, where) {
  const box = await page.getByTestId('practice-board').last().boundingBox();
  check(`${where}: board 328×328`, box && Math.round(box.width) === 328, box ? `${box.width}` : '');
}

/** Bottom of the content: the feedback card (+ gap + 48 px button on mark screens). */
async function contentHeight(page, extra) {
  const box = await page.getByTestId('practice-feedback').last().boundingBox();
  return box.y + box.height + extra;
}

/** WCAG contrast of two #RRGGBB colours. */
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function token(name) {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'theme', 'tokens.ts'), 'utf8');
  return source.match(new RegExp(`${name}: '(#[0-9A-Fa-f]{6})'`))[1];
}

async function mapChecks(browser, base, locale) {
  const s = strings(locale);
  const L = `[${locale}]`;
  const { context, page } = await newPage(browser, locale);
  await page.goto(`${base}/`);
  await page.getByTestId('home-node-unit-12').waitFor({ timeout: 30000 });
  await page.getByTestId('home-node-checkpoint-14').scrollIntoViewIfNeeded();
  await wait(page, 300);
  check(
    `${L} 24 no unit is coming soon`,
    (await page.getByText(s['home.unit.comingSoon'], { exact: true }).count()) === 0,
  );
  for (const id of ['unit-12', 'unit-13', 'unit-14', 'checkpoint-14']) {
    check(`${L} 24 node ${id}`, (await count(page, `home-node-${id}`)) === 1);
  }
  check(`${L} 24 Unit 11 rows unchanged`, (await count(page, 'home-node-lesson-u11-vital')) === 1);
  const width = await page.evaluate(() => document.scrollingElement.scrollWidth);
  check(`${L} 24 no horizontal overflow`, width <= VIEWPORT.width, `${width}`);
  await shot(page, `24-map-units-12-14-${locale}`);
  await context.close();
}

async function explainChecks(browser, base, locale) {
  const L = `[${locale}]`;
  const { context, page } = await newPage(browser, locale);
  await page.goto(`${base}/lesson/u12-territory`);
  await page.getByTestId('lesson-next').waitFor({ timeout: 30000 });
  await press(page, 'lesson-next');
  await press(page, 'lesson-next');
  await wait(page, 300);
  let squares = 0;
  for (let r = 1; r <= 5; r++) {
    squares += await count(page, `board-territory-B-a${r}`);
    squares += await count(page, `board-territory-W-e${r}`);
    squares += await count(page, `board-marker-circle-c${r}`);
  }
  check(
    `${L} 25 u12 s3: 5 black squares, 5 white squares, 5 circles`,
    squares === 15,
    `${squares}`,
  );
  const textBox = await page.getByTestId('lesson-text-card').boundingBox();
  const boardBox = await page.getByTestId('lesson-board-area').boundingBox();
  check(`${L} 25 text card above the board`, textBox.y + textBox.height <= boardBox.y + 0.5);
  await shot(page, `25-explain-u12-s3-${locale}`);

  await page.goto(`${base}/lesson/u14-end`);
  await page.getByTestId('lesson-next').waitFor({ timeout: 30000 });
  await press(page, 'lesson-next');
  await press(page, 'lesson-next');
  await wait(page, 300);
  check(`${L} 38 u14 s3 dead marker on c1`, (await count(page, 'board-marker-dead-c1')) === 1);
  await shot(page, `38-explain-u14-s3-dead-${locale}`);
  await context.close();
}

/** Unit 12: mark screens 26–30 (en only, plus fr for the longest feedback 28). */
async function markChecks(browser, base, locale) {
  const s = strings(locale);
  const L = `[${locale}]`;
  const { context, page } = await newPage(browser, locale);
  await openPractice(page, base, 'u12-territory');
  // e1 (A): a1..a5.
  await mark(page, ['a1', 'a2', 'a3', 'a4', 'a5']);
  await hitArea(page, `${L} mark`, 'practice-mark-clear');
  await hitArea(page, `${L} mark`, 'practice-check');
  await boardIs328(page, `${L} mark`);
  const markHeight = await contentHeight(page, 8 + 48);
  check(`${L} mark screen ≤ 660 px`, markHeight <= 660, `${markHeight.toFixed(0)}`);
  await press(page, 'practice-check');
  await hitArea(page, `${L} mark`, 'practice-next');
  await press(page, 'practice-next');

  // e2 (C): a1 a2 → 26; Check → 27 (missing line, marks kept); two more → revealed 29.
  await mark(page, ['a1', 'a2']);
  const counter = fill(s['practice.mark.count'], { count: 2 });
  check(`${L} 26 counter "${counter}"`, (await text(page, 'practice-mark-count')) === counter);
  check(`${L} 26 Clear visible`, (await count(page, 'practice-mark-clear')) === 1);
  const width = await page.evaluate(() => document.scrollingElement.scrollWidth);
  check(`${L} 26 no horizontal overflow`, width <= VIEWPORT.width, `${width}`);
  await shot(page, `26-mark-two-marks-${locale}`);
  await press(page, 'practice-check');
  const missing = fill(s['fb.mark.missing_other'], { count: 5 });
  check(`${L} 27 missing line`, (await text(page, 'practice-feedback')).includes(missing));
  check(`${L} 27 marks kept`, (await count(page, 'board-territory-B-a1')) === 1);
  await shot(page, `27-mark-missing-${locale}`);
  await press(page, 'practice-check');
  await press(page, 'practice-check');
  check(`${L} 29 revealed: 7 squares`, (await count(page, 'board-territory-B-e1')) === 1);
  check(`${L} 29 revealed: Next only`, (await count(page, 'practice-check')) === 0);
  await shot(page, `29-mark-revealed-${locale}`);
  await press(page, 'practice-next');

  // e3 (C2): d4 + two Checks → hint open, ring on e5 → 30.
  await mark(page, ['d4']);
  await press(page, 'practice-check');
  await press(page, 'practice-check');
  check(`${L} 30 hint ring on e5`, (await count(page, 'board-highlight-hint-e5')) === 1);
  check(
    `${L} 30 hint ring only on hintPoints`,
    (await count(page, 'board-highlight-hint-d5')) === 0,
  );
  await shot(page, `30-mark-hint-${locale}`);
  await mark(page, ['a5', 'b5', 'c5', 'd5', 'e4', 'e5']);
  await press(page, 'practice-check');
  await press(page, 'practice-next');

  // e4 choice: nobody.
  await press(page, 'practice-option-2');
  await press(page, 'practice-next');

  // e5 (P3): a1..a5 + c3 → the neutral line with "c3" while c3 flashes → 28.
  await mark(page, ['a1', 'a2', 'a3', 'a4', 'a5', 'c3']);
  await page.getByTestId('practice-check').last().click();
  await wait(page, 150);
  const dame = fill(s['fb.mark.extra.dame'], { points: 'c3' });
  check(`${L} 28 neutral line`, (await text(page, 'practice-feedback')).includes(dame));
  check(`${L} 28 c3 flashes`, (await count(page, 'board-highlight-error-c3')) === 1);
  await shot(page, `28-mark-neutral-${locale}`);
  await wait(page, FLASH_MS);
  check(
    `${L} 28 c3 removed, a-marks stay`,
    (await count(page, 'board-territory-B-c3')) === 0 &&
      (await count(page, 'board-territory-B-a1')) === 1,
  );
  // Screen reader labels on web (react-native-web reports a screen reader).
  const label = await page
    .getByTestId('board-point-a1')
    .last()
    .getAttribute('aria-label')
    .catch(() => null);
  check(
    `${L} AC 37 a1 aria-label names the territory`,
    label === null || label.includes(s['board.a11y.highlight.territoryB']),
    label ?? 'no points layer',
  );
  await context.close();
}

/** Unit 14: dead marks 31–32 and the deadKept line (35). */
async function deadChecks(browser, base, locale) {
  const s = strings(locale);
  const L = `[${locale}]`;
  const { context, page } = await newPage(browser, locale);
  await openPractice(page, base, 'u14-end');
  await press(page, 'practice-option-0');
  await press(page, 'practice-next');
  await press(page, 'practice-option-0');
  await press(page, 'practice-next');
  // e3 (K): c1.
  await mark(page, ['c1']);
  check(`${L} 31 c1 dead marker`, (await count(page, 'board-marker-dead-c1')) === 1);
  await shot(page, `31-dead-one-${locale}`);
  await press(page, 'practice-check');
  await press(page, 'practice-next');
  // e4 (K2): c5.
  await mark(page, ['c5']);
  await press(page, 'practice-check');
  await press(page, 'practice-next');
  // e5 (N): c1 + a2 (black wall) → whyKey, wall unmarked, c1 kept → 32.
  await mark(page, ['c1', 'a2']);
  check(`${L} 31 whole wall dimmed`, (await count(page, 'board-marker-dead-e2')) === 1);
  await press(page, 'practice-check');
  await wait(page, FLASH_MS);
  const why = s['lesson.u14-end.e5.w.black'];
  check(`${L} 32 whyKey line`, (await text(page, 'practice-feedback')).includes(why));
  check(`${L} 32 wall unmarked`, (await count(page, 'board-marker-dead-a2')) === 0);
  check(`${L} 32 c1 still dead`, (await count(page, 'board-marker-dead-c1')) === 1);
  await shot(page, `32-dead-wall-refused-${locale}`);
  await mark(page, ['c5']);
  await press(page, 'practice-check');
  await press(page, 'practice-next');
  // e6 (K, dead c1): type 5 → deadKept → 35b.
  check(`${L} 35 dead c1 drawn from the start`, (await count(page, 'board-marker-dead-c1')) === 1);
  await type(page, 5);
  await press(page, 'practice-check');
  check(
    `${L} 35 deadKept line`,
    (await text(page, 'practice-feedback')).includes(s['fb.count.score.deadKept']),
  );
  await shot(page, `35-count-deadkept-${locale}`);
  await context.close();
}

/** Unit 13: stonesOnly (35), revealed (36), winner choice (37), 7×7 entry with dots (33). */
async function countChecks(browser, base, locale) {
  const s = strings(locale);
  const L = `[${locale}]`;
  const { context, page } = await newPage(browser, locale);
  await openPractice(page, base, 'u13-counting');
  await type(page, 6);
  await press(page, 'practice-check');
  await press(page, 'practice-next');
  await type(page, 7);
  await press(page, 'practice-check');
  await press(page, 'practice-next');
  // e3 (D, area 13): 6 → stonesOnly; then 14, 10 → revealed with the reveal line.
  await type(page, 6);
  await press(page, 'practice-check');
  check(
    `${L} 35 stonesOnly line`,
    (await text(page, 'practice-feedback')).includes(s['fb.count.score.stonesOnly']),
  );
  await shot(page, `35-count-stonesonly-${locale}`);
  await clearEntry(page);
  await type(page, 14);
  await press(page, 'practice-check');
  await clearEntry(page);
  await type(page, 10);
  await press(page, 'practice-check');
  const reveal = fill(s['fb.count.score.reveal'], { stones: 6, territory: 7, total: 13 });
  check(`${L} 36 reveal line`, (await text(page, 'practice-feedback')).includes(reveal));
  check(`${L} 36 territory squares`, (await count(page, 'board-territory-B-a1')) === 1);
  await shot(page, `36-count-revealed-${locale}`);
  await press(page, 'practice-next');
  // e4 (C): 12.
  await type(page, 12);
  await press(page, 'practice-check');
  await press(page, 'practice-next');
  // e5 komi choice: Black (wrong) → whyKey → 37.
  await press(page, 'practice-option-0');
  check(
    `${L} 37 wrong winner whyKey`,
    (await text(page, 'practice-feedback')).includes(s['lesson.u13-counting.e5.w.black']),
  );
  await shot(page, `37-choice-winner-why-${locale}`);
  // Two options: one wrong answer reveals the right one (M3 attempts rule), so Next follows.
  await press(page, 'practice-next');
  // e6 (R3, 7×7): three scratch dots and "25" → 33.
  await mark(page, ['a1', 'b1', 'c1'], 7);
  check(`${L} 33 scratch dots`, (await count(page, 'board-scratch-b1')) === 1);
  await type(page, 25);
  await fits(page, `${L} 33 count 7×7`, [
    'practice-close',
    'practice-count-display',
    'practice-check',
    'practice-key-9',
    'practice-feedback',
  ]);
  await shot(page, `33-count-entry-7x7-${locale}`);
  await context.close();
}

/** Review 4 r4 (9×9 entry): no scroll, one entry row, keys ≥ 44 (34). */
async function nineChecks(browser, base, locale) {
  const L = `[${locale}]`;
  const { context, page } = await newPage(browser, locale);
  await openPractice(page, base, 'u14-review');
  await mark(page, ['a5', 'b5', 'c5', 'd5', 'e5']);
  await press(page, 'practice-check');
  await press(page, 'practice-next');
  await press(page, 'practice-option-2');
  await press(page, 'practice-next');
  await type(page, 10);
  await press(page, 'practice-check');
  await press(page, 'practice-next');
  await type(page, 45);
  await boardIs328(page, `${L} 34 count 9×9`);
  await fits(page, `${L} 34 count 9×9`, [
    'practice-close',
    'practice-prompt',
    'practice-board',
    'practice-count-display',
    'practice-count-backspace',
    'practice-check',
    'practice-key-0',
    'practice-key-9',
    'practice-feedback',
  ]);
  const row = await Promise.all(
    ['practice-count-display', 'practice-count-backspace', 'practice-check'].map((id) =>
      page.getByTestId(id).last().boundingBox(),
    ),
  );
  check(
    `${L} 34 display, ⌫ and Check on one row`,
    row.every((b) => Math.abs(b.y - row[0].y) < 1),
    row.map((b) => b.y.toFixed(0)).join('/'),
  );
  for (const id of [
    'practice-count-backspace',
    'practice-check',
    ...Array.from({ length: 10 }, (_, n) => `practice-key-${n}`),
  ]) {
    await hitArea(page, `${L} 34`, id);
  }
  const bottom = await contentHeight(page, 0);
  check(`${L} 34 count-entry total ≤ 724`, bottom <= 724, `${bottom.toFixed(0)}`);
  await shot(page, `34-count-entry-9x9-${locale}`);
  await press(page, 'practice-check');
  await hitArea(page, `${L} 34`, 'practice-next');
  await context.close();
}

/** Regressions (39): a tap-point and a chip count in u02 look as before. */
async function regressionChecks(browser, base) {
  const { context, page } = await newPage(browser, 'en');
  await openPractice(page, base, 'u02-liberties');
  await shot(page, '39-regression-tap-point-u02-en');
  // u02 e1: tap the four liberties of d3, then Check.
  for (const v of ['c3', 'd4', 'e3', 'd2']) await tap(page, v, 5, false);
  await press(page, 'practice-check');
  await press(page, 'practice-next');
  check(
    '[en] 39 chip count keeps the 0–9 chips',
    (await count(page, 'practice-chip-0')) === 1 && (await count(page, 'practice-key-0')) === 0,
  );
  await shot(page, '39-regression-chip-count-u02-en');
  await context.close();
}

async function main() {
  exportWeb();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS)) {
    if (/^(2[4-9]|3\d)-.*\.png$/.test(f)) fs.rmSync(path.join(SHOTS, f));
  }

  try {
    const bamboo = token('bamboo');
    const black = contrast(token('black'), bamboo);
    const edge = contrast(token('whiteEdge'), bamboo);
    check('AC 55 black square vs board ≥ 3:1', black >= 3, black.toFixed(1));
    check('AC 55 white square outline vs board ≥ 3:1', edge >= 3, edge.toFixed(1));
    for (const locale of LOCALES) {
      await mapChecks(browser, base, locale);
      await explainChecks(browser, base, locale);
      await markChecks(browser, base, locale);
      await deadChecks(browser, base, locale);
      await countChecks(browser, base, locale);
      await nineChecks(browser, base, locale);
    }
    await regressionChecks(browser, base);
  } finally {
    await browser.close();
    server.close();
  }

  check('zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll M5 territory & counting web checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
