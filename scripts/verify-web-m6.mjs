#!/usr/bin/env node
// M6 web verification (spec docs/specs/M6-bot-levels.md §4.3, 4.4, 4.6): Home card, level picker,
// a 9x9 game in progress, pass / Count now / Resign sheets, dead-stone marking, count screen and
// resign result in zh-CN (all) and en / fr (key screens) at 360x740. Screenshots go to
// docs/screenshots/M6/. Exits non-zero on a failed check.
//
//   npm run verify:web:m6              # always re-exports dist/ first
//   npm run verify:web:m6 -- --reuse   # reuse dist/
//
// Not part of Jest or CI: it needs a browser (CHROMIUM_PATH, PLAYWRIGHT_PATH as for M4/M5).

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'docs', 'screenshots', 'M6');
const CLOUD_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROMIUM =
  process.env.CHROMIUM_PATH ?? (fs.existsSync(CLOUD_CHROMIUM) ? CLOUD_CHROMIUM : undefined);
const VIEWPORT = { width: 360, height: 740 };
const COLUMNS = 'abcdefghjklmnopqrst';
const LOCALES = ['zh-CN', 'en', 'fr'];

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
  console.log('Exporting the release web build…');
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
const accessibleWarnings = [];
const ACCESSIBLE_WARNING = /non-boolean attribute `?(accessible|collapsable)`?/;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const wait = (page, ms) => page.waitForTimeout(ms);
const count = (page, id) => page.getByTestId(id).count();
const has = async (page, id) => (await count(page, id)) > 0;

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

/** Progress with 1 star everywhere except `u14-end` when `unlocked` is false. */
function progress(unlocked, extra = {}) {
  const entry = {
    stars: 1,
    plays: 1,
    bestClean: 4,
    bestSolved: 4,
    total: 7,
    lastPlayedAt: '2026-10-21T00:00:00.000Z',
  };
  const ids = unlocked ? LESSON_IDS : LESSON_IDS.filter((id) => id !== 'u14-end');
  return JSON.stringify({
    v: 1,
    lessons: Object.fromEntries(ids.map((id) => [id, entry])),
    ...extra,
  });
}

async function newPage(browser, locale, unlocked = true, extra = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale });
  await context.addInitScript(
    (value) =>
      !window.localStorage.getItem('progress') && window.localStorage.setItem('progress', value),
    progress(unlocked, extra),
  );
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[${locale}] ${m.text()}`);
    // M6-beginner-friendly AC 43: this warning must never come back (any message type).
    if (ACCESSIBLE_WARNING.test(m.text())) accessibleWarnings.push(`[${locale}] ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`[${locale}] pageerror ${e.message}`));
  return { context, page };
}

async function press(page, testId) {
  await page.getByTestId(testId).last().click();
  await wait(page, 250);
}

/** Touch-down + touch-up on a vertex of the 9x9 board (coordinates shown: margin 1 cell). */
async function tap(page, vertex) {
  const box = await page.getByTestId('game9-board').last().boundingBox();
  const cell = box.width / (9 - 1 + 2);
  const x = box.x + (1 + COLUMNS.indexOf(vertex[0])) * cell;
  const y = box.y + (1 + 9 - Number(vertex.slice(1))) * cell;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await wait(page, 150);
}

/** Learner move, then wait until the bot has answered (the status stops saying thinking). */
async function move(page, vertex) {
  await tap(page, vertex);
  await wait(page, 1500);
}

/** No page scroll; board 328; every control >= 44 px; nothing clipped; every box inside 360. */
async function layout(page, where, { board = true } = {}) {
  const { width, height } = await page.evaluate(() => ({
    width: document.scrollingElement.scrollWidth,
    height: document.scrollingElement.scrollHeight,
  }));
  check(
    `${where}: no page scroll`,
    width <= VIEWPORT.width && height <= VIEWPORT.height,
    `${width}x${height}`,
  );
  if (board && (await has(page, 'game9-board'))) {
    const box = await page.getByTestId('game9-board').last().boundingBox();
    check(
      `${where}: board 328 wide, inside 360`,
      Math.round(box.width) === 328 && box.x >= 0 && box.x + box.width <= 360,
      `${box.width}`,
    );
  }
  const bad = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[role=button], button, [data-testid]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const isButton = el.getAttribute('role') === 'button' || el.tagName === 'BUTTON';
      if (isButton && (r.height < 43.5 || r.width < 43.5))
        out.push(
          `small ${el.getAttribute('data-testid')} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
    }
    for (const el of document.querySelectorAll('div,span')) {
      if (
        !el.childNodes.length ||
        ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      )
        continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'inline') continue;
      const clipped = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
      if (clipped && cs.overflow !== 'visible')
        out.push(
          `clipped "${el.textContent.trim().slice(0, 30)}" ${el.scrollWidth}/${el.clientWidth} ${el.scrollHeight}/${el.clientHeight}`,
        );
      const r = el.getBoundingClientRect();
      if (r.right > 360.5 || r.left < -0.5)
        out.push(
          `outside "${el.textContent.trim().slice(0, 30)}" ${Math.round(r.left)}..${Math.round(r.right)}`,
        );
    }
    return out;
  });
  check(
    `${where}: tap targets >= 44, no clipped or out-of-screen text`,
    bad.length === 0,
    bad.slice(0, 4).join(' | '),
  );
}

/** Layout rule: instructions/status above the board, feedback or buttons below it. */
async function order(page, where) {
  const status = await page.getByTestId('game9-status').last().boundingBox();
  const board = await page.getByTestId('game9-board').last().boundingBox();
  check(`${where}: status above board`, status.y + status.height <= board.y + 0.5);
}

async function openGame(page, base, level) {
  await page.goto(`${base}/game/play?level=${level}`);
  await page.getByTestId('game9-board').waitFor({ timeout: 30000 });
  await wait(page, 400);
}

const FIRST = ['c3', 'g7', 'c7', 'g3', 'e5', 'e3', 'e7'];

async function homeChecks(browser, base, locale) {
  const L = `[${locale}]`;
  for (const unlocked of [false, true]) {
    const { context, page } = await newPage(browser, locale, unlocked);
    await page.goto(`${base}/`);
    const id = unlocked ? 'home-game9' : 'home-game9-locked';
    await page.getByTestId(id).waitFor({ timeout: 30000 });
    await page.getByTestId(id).scrollIntoViewIfNeeded();
    await wait(page, 300);
    const box = await page.getByTestId(id).boundingBox();
    check(
      `${L} home card ${unlocked ? 'open' : 'locked'} >= 44 tall`,
      box.height >= 44,
      `${box.height}`,
    );
    const w = await page.evaluate(() => document.scrollingElement.scrollWidth);
    check(`${L} home no horizontal overflow`, w <= 360, `${w}`);
    await shot(page, `01-home-card-${unlocked ? 'unlocked' : 'locked'}-${locale}`);
    if (!unlocked) {
      await page.getByTestId(id).click();
      await wait(page, 400);
      check(`${L} locked card does not navigate`, !page.url().includes('/game'));
    } else {
      await page.getByTestId(id).click();
      await page.getByTestId('game9-level-1').waitFor({ timeout: 10000 });
      check(`${L} card opens /game`, page.url().includes('/game'));
    }
    await context.close();
  }
}

async function pickerChecks(browser, base, locale) {
  const L = `[${locale}]`;
  const extra = {
    bots: {
      1: { games: 1, wins: 1, lossStreak: 0, firstWinAt: '2026-10-21T00:00:00.000Z' },
      3: { games: 3, wins: 0, lossStreak: 3 },
    },
  };
  const { context, page } = await newPage(browser, locale, true, extra);
  await page.goto(`${base}/game`);
  await page.getByTestId('game9-level-1').waitFor({ timeout: 30000 });
  await wait(page, 400);
  for (const n of [1, 2, 3]) {
    const box = await page.getByTestId(`game9-level-${n}`).boundingBox();
    check(`${L} picker row ${n} >= 64 tall`, box.height >= 64, `${box.height}`);
  }
  await layout(page, `${L} picker`, { board: false });
  await shot(page, `02-picker-${locale}`);
  // M6-beginner-friendly AC 7: a tap selects the level; Start starts the game.
  await press(page, 'game9-level-2');
  await press(page, 'game9-start');
  await page.getByTestId('game9-board').waitFor({ timeout: 10000 });
  check(`${L} Start starts the game`, true);
  await context.close();
}

async function gameChecks(browser, base, locale) {
  const L = `[${locale}]`;
  const { context, page } = await newPage(browser, locale);
  await openGame(page, base, 1);
  await layout(page, `${L} new game`);
  await order(page, `${L} new game`);
  check(`${L} Count now hidden before 6 moves`, !(await has(page, 'game9-count-now')));
  await shot(page, `03-game-new-${locale}`);

  // Preview on touch-down, commit on touch-up, then "thinking".
  const box = await page.getByTestId('game9-board').boundingBox();
  const cell = box.width / 10;
  await page.mouse.move(box.x + 3 * cell, box.y + 7 * cell);
  await page.mouse.down();
  await wait(page, 150);
  await shot(page, `04-game-preview-${locale}`);
  await page.mouse.up();
  await wait(page, 150);
  await shot(page, `05-game-thinking-${locale}`);
  await wait(page, 1500);
  for (const v of FIRST.slice(1)) await move(page, v);
  await layout(page, `${L} in progress`);
  await order(page, `${L} in progress`);
  check(`${L} Count now visible after 6 moves`, await has(page, 'game9-count-now'));
  await shot(page, `06-game-progress-${locale}`);

  // Illegal tap (occupied).
  await tap(page, 'c3');
  await wait(page, 300);
  await shot(page, `07-game-illegal-${locale}`);

  // Resign sheet then keep playing.
  await press(page, 'game9-resign');
  await page.getByTestId('game9-resign-sheet').waitFor();
  await layout(page, `${L} resign sheet`);
  await shot(page, `08-resign-sheet-${locale}`);
  await press(page, 'game9-resign-keep');

  // Count now sheet.
  await press(page, 'game9-count-now');
  await page.getByTestId('game9-count-sheet').waitFor();
  await layout(page, `${L} count-now sheet`);
  await shot(page, `09-count-now-sheet-${locale}`);
  await press(page, 'game9-count-confirm');
  await page.getByTestId('game9-mark-done').waitFor({ timeout: 10000 });
  await layout(page, `${L} mark`);
  await order(page, `${L} mark`);
  await shot(page, `10-mark-${locale}`);

  // Mark a group (the learner's first stone), Done -> bot answers.
  await tap(page, 'c3');
  await wait(page, 200);
  await shot(page, `11-mark-selected-${locale}`);
  await press(page, 'game9-mark-done');
  await wait(page, 500);
  await layout(page, `${L} after Done`);
  await shot(page, `12-mark-bot-answer-${locale}`);
  if (await has(page, 'game9-dispute-sheet')) {
    await shot(page, `13-dispute-sheet-${locale}`);
    await press(page, 'game9-dispute-accept');
  }
  if (!(await has(page, 'game9-count-done'))) {
    // an alive dispute: clear the marks and agree
    if (await has(page, 'game9-mark-clear')) await press(page, 'game9-mark-clear');
    await press(page, 'game9-mark-done');
    if (await has(page, 'game9-dispute-sheet')) await press(page, 'game9-dispute-accept');
  }
  await page.getByTestId('game9-count-done').waitFor({ timeout: 10000 });
  await layout(page, `${L} count`);
  check(`${L} count table shown`, await has(page, 'game9-count-table'));
  await shot(page, `14-count-${locale}`);
  await press(page, 'game9-count-done');
  await wait(page, 300);
  await layout(page, `${L} result`, { board: false });
  await shot(page, `15-result-${locale}`);
  await context.close();
}

async function passChecks(browser, base, locale) {
  const L = `[${locale}]`;
  const { context, page } = await newPage(browser, locale);
  await openGame(page, base, 1);
  for (const v of FIRST.slice(0, 3)) await move(page, v);
  await press(page, 'game9-pass');
  await page.getByTestId('game9-pass-sheet').waitFor();
  await layout(page, `${L} pass explainer`);
  await shot(page, `16-pass-explainer-${locale}`);
  await press(page, 'game9-pass-ok');
  await wait(page, 1500);
  await layout(page, `${L} after pass`);
  await shot(page, `17-after-pass-${locale}`);
  await context.close();
}

async function resignChecks(browser, base, locale) {
  const L = `[${locale}]`;
  const { context, page } = await newPage(browser, locale);
  await openGame(page, base, 2);
  for (const v of FIRST.slice(0, 2)) await move(page, v);
  await press(page, 'game9-resign');
  await press(page, 'game9-resign-confirm');
  await page.getByTestId('game9-show-count').waitFor({ timeout: 10000 });
  check(`${L} resign result shows Show the count`, true);
  await layout(page, `${L} resign result`, { board: false });
  await shot(page, `18-resign-result-${locale}`);
  await press(page, 'game9-show-count');
  await page.getByTestId('game9-count-done').waitFor({ timeout: 10000 });
  check(`${L} hypothetical caption`, await has(page, 'game9-hypothetical'));
  await layout(page, `${L} hypothetical count`);
  await shot(page, `19-resign-count-${locale}`);
  await context.close();
}

async function main() {
  exportWeb();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS)) if (f.endsWith('.png')) fs.rmSync(path.join(SHOTS, f));
  try {
    for (const locale of LOCALES) {
      await homeChecks(browser, base, locale);
      await pickerChecks(browser, base, locale);
      await gameChecks(browser, base, locale);
      await passChecks(browser, base, locale);
      await resignChecks(browser, base, locale);
    }
  } finally {
    await browser.close();
    server.close();
  }
  check('zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
  check(
    'no "non-boolean attribute accessible / collapsable" warning (AC 43)',
    accessibleWarnings.length === 0,
    accessibleWarnings.slice(0, 3).join(' | '),
  );
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll M6 web checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
