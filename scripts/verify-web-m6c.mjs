#!/usr/bin/env node
// M6 game-coaching web verification (spec docs/specs/M6-game-coaching.md §4.2-4.5, §5): a move
// note after a capture, the 提示 hint, hints used up, the post-game review 复盘 with a real moment
// and a quiet review, in zh-CN, en and fr at 360x740. Math.random is pinned in the page so the
// bot is deterministic (seed 3, Easy): the scripted learner moves always meet the same replies.
// Screenshots go to docs/screenshots/M6/50-*.jpg. Exits non-zero on a failed check.
//
//   npm run verify:web:m6c              # always re-exports dist/ first
//   npm run verify:web:m6c -- --reuse   # reuse dist/
//
// Not part of Jest or CI: it needs Node 22, a browser (CHROMIUM_PATH, PLAYWRIGHT_PATH as for M4/M5).

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
const SEED = 3;

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
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
}

const shot = (page, name) =>
  page.screenshot({ path: path.join(SHOTS, `${name}.jpg`), type: 'jpeg', quality: 80 });
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
  // Pin Math.random: the game seed is floor(random * 0x7fffffff), so every game has SEED.
  await context.addInitScript((seed) => {
    Math.random = () => (seed + 0.5) / 0x7fffffff;
  }, SEED);
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`[${locale}] ${m.text()}`));
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

async function openGame(page, base, level) {
  await page.goto(`${base}/game/play?level=${level}`);
  await page.getByTestId('game9-board').waitFor({ timeout: 30000 });
  await wait(page, 400);
}

const CAP_MOVES = ['j9', 'j7', 'g9', 'h8', 'j9', 'h5', 'h4', 'h3']; // 5th move captures (note)
const QUIET_MOVES = ['j9', 'a7', 'a1', 'c4', 'j4', 'd9', 'd1', 'e5'];

async function boardY(page) {
  return Math.round((await page.getByTestId('game9-board').last().boundingBox()).y);
}

async function noteText(page) {
  return (await page.getByTestId('practice-feedback').last().innerText()).trim();
}

async function coachGame(browser, base, locale) {
  const L = `[${locale}]`;
  const { context, page } = await newPage(browser, locale);
  await openGame(page, base, 1);
  const y0 = await boardY(page);
  const hint = page.getByTestId('game9-hint').last();
  check(`${L} hint button >= 44 tall`, (await hint.boundingBox()).height >= 43.5);

  // Hint shown (1 of 3 used), then ignored: any move removes it.
  await press(page, 'game9-hint');
  check(`${L} hint shows a reason`, (await noteText(page)).length > 0, await noteText(page));
  check(`${L} board did not jump (hint)`, (await boardY(page)) === y0);
  await layout(page, `${L} hint shown`);
  await shot(page, `50-hint-${locale}`);
  await press(page, 'game9-hint'); // AC 18: a second tap changes nothing
  let seen = 0;
  const notes = [];
  for (let i = 0; i < CAP_MOVES.length; i++) {
    await tap(page, CAP_MOVES[i]);
    const mid = await noteText(page);
    await wait(page, 1500);
    const after = await noteText(page);
    if (mid || after) notes.push(`${i + 1}: ${mid} || ${after}`);
    check(`${L} board did not jump (move ${i + 1})`, (await boardY(page)) === y0);
    if (i === 4) {
      check(`${L} the 5th move shows a capture note`, mid.length > 0, mid);
      check(`${L} the note is text, not an i18n key`, !/^coach\./.test(mid), mid);
      await layout(page, `${L} note after capture`);
      await shot(page, `51-note-capture-${locale}`);
      seen++;
    }
    if (i === 1 || i === 2) {
      await press(page, 'game9-hint'); // uses 2 and 3
    }
  }
  console.log(`${L} notes seen: ${notes.join(' ## ')}`);
  const left = await page.getByTestId('game9-hint').last();
  check(`${L} hints exhausted: button disabled`, await left.isDisabled());
  check(`${L} exhausted hint button still >= 44`, (await left.boundingBox()).height >= 43.5);
  await layout(page, `${L} hints exhausted`);
  await shot(page, `52-hints-exhausted-${locale}`);
  check(`${L} capture note screenshot taken`, seen === 1);

  // Resign -> result with the Review button -> review.
  await press(page, 'game9-resign');
  await press(page, 'game9-resign-confirm');
  await page.getByTestId('game9-review').waitFor({ timeout: 10000 });
  await layout(page, `${L} result with Review`, { board: false });
  await shot(page, `53-result-review-${locale}`);
  await press(page, 'game9-review');
  await page.getByTestId('review').waitFor({ timeout: 10000 });
  await shot(page, `54-review-preparing-${locale}`);
  await page.getByTestId('review-chip-1').waitFor({ timeout: 60000 });
  await wait(page, 300);
  check(`${L} review has a moment`, await has(page, 'review-chip-1'));
  await layout(page, `${L} review moment`, { board: false });
  const rb = await page.getByTestId('review-board').last().boundingBox();
  check(`${L} review board inside 360`, rb.x >= 0 && rb.x + rb.width <= 360, `${rb.width}`);
  await shot(page, `55-review-default-${locale}`);
  await press(page, 'review-chip-1'); // the position just before the moment
  const yBefore = Math.round((await page.getByTestId('review-board').last().boundingBox()).y);
  const stepText = await page.getByTestId('review-step').last().innerText();
  check(
    `${L} review text is not an i18n key`,
    !/coach\./.test(await page.locator('body').innerText()),
    stepText,
  );
  await shot(page, `56-review-moment-${locale}`);
  await press(page, 'review-next');
  const rb2 = await page.getByTestId('review-board').last().boundingBox();
  check(`${L} review board did not jump`, Math.round(rb2.y) === yBefore);
  await layout(page, `${L} review next`, { board: false });
  await shot(page, `57-review-next-${locale}`);
  await press(page, 'review-close');
  check(`${L} close returns to the result`, await has(page, 'game9-review'));
  await context.close();
}

async function quietGame(browser, base, locale) {
  const L = `[${locale}]`;
  const { context, page } = await newPage(browser, locale);
  await openGame(page, base, 1);
  for (const v of QUIET_MOVES) await move(page, v);
  await press(page, 'game9-resign');
  await press(page, 'game9-resign-confirm');
  await page.getByTestId('game9-review').waitFor({ timeout: 10000 });
  await press(page, 'game9-review');
  await page.getByTestId('review-quiet').waitFor({ timeout: 60000 });
  check(`${L} quiet review text`, true);
  await layout(page, `${L} quiet review`, { board: false });
  await shot(page, `58-review-quiet-${locale}`);
  await context.close();

  // Under 10 moves: no Review button.
  const short = await newPage(browser, locale);
  await openGame(short.page, base, 1);
  for (const v of QUIET_MOVES.slice(0, 2)) await move(short.page, v);
  await press(short.page, 'game9-resign');
  await press(short.page, 'game9-resign-confirm');
  await short.page.getByTestId('game9-show-count').waitFor({ timeout: 10000 });
  check(`${L} no Review button under 10 moves`, !(await has(short.page, 'game9-review')));
  await short.context.close();
}

async function main() {
  exportWeb();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS))
    if (/^5\d-.*\.jpg$/.test(f)) fs.rmSync(path.join(SHOTS, f));
  try {
    for (const locale of LOCALES) {
      await coachGame(browser, base, locale);
      await quietGame(browser, base, locale);
    }
  } finally {
    await browser.close();
    server.close();
  }
  check('zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll M6 coaching web checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
