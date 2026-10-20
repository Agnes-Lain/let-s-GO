#!/usr/bin/env node
// M5 item 4 web verification (spec docs/specs/M5-sequence-v2.md AC 29, §5).
//
// Exports the release web build, serves it and drives it in Chromium at 360×740 in en, fr, zh-CN:
// the four runner states of u09-ladder "ladder-play-corner" (7×7, coordinates): A start,
// B mid-ladder, C wrong move with the reply and two facts, D solved (23-*). Checks that nothing
// scrolls and every control is on screen. Screenshots go to docs/screenshots/M5/ (only 23-* are
// replaced). Exits non-zero on any failed check.
//
//   npm run verify:web:m5d              # always re-exports dist/ first
//   npm run verify:web:m5d -- --reuse   # reuse dist/ (must be a release export)
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

/** Touch-down + touch-up on a vertex of a board WITH coordinates (margin 1 cell). */
async function tap(page, vertex, size = 5, testId = 'practice-board') {
  const box = await page.getByTestId(testId).last().boundingBox();
  const cell = box.width / (size + 1);
  const x = box.x + (1 + COLUMNS.indexOf(vertex[0])) * cell;
  const y = box.y + (1 + size - Number(vertex.slice(1))) * cell;
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

/** 1★ on every lesson up to u11-vital: every node is open. */
function progress() {
  const entry = {
    stars: 1,
    plays: 1,
    bestClean: 4,
    bestSolved: 4,
    total: 7,
    lastPlayedAt: '2026-10-20T00:00:00.000Z',
  };
  const ids = [
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
  ];
  return JSON.stringify({ v: 1, lessons: Object.fromEntries(ids.map((id) => [id, entry])) });
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

const CONTROLS = [
  'practice-close',
  'practice-prompt',
  'sequence-progress',
  'practice-board',
  'practice-feedback',
];
const wait = (page, ms) => page.waitForTimeout(ms);

/** Solves u09-ladder exercises 1–8 so that "ladder-play-corner" (#9) is on screen. */
async function toCorner(page) {
  await press(page, 'practice-chip-2');
  await press(page, 'practice-check');
  await press(page, 'practice-next');
  await press(page, 'practice-option-0');
  await press(page, 'practice-next');
  await tap(page, 'a3');
  await press(page, 'practice-next');
  await tap(page, 'e5');
  await press(page, 'practice-next');
  for (const at of ['c4', 'e3', 'd5', 'e5']) {
    await tap(page, at);
    await wait(page, 700);
  }
  await press(page, 'practice-next');
  await press(page, 'practice-option-1');
  await press(page, 'practice-next');
  await tap(page, 'f5', 7);
  await press(page, 'practice-next');
  await press(page, 'practice-option-0');
  await press(page, 'practice-next');
  await wait(page, 400);
}

async function main() {
  exportWeb();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS)) {
    if (/^23-.*\.png$/.test(f)) fs.rmSync(path.join(SHOTS, f));
  }

  try {
    for (const locale of LOCALES) {
      const s = strings(locale);
      const { context, page } = await newPage(browser, locale);
      const L = `[${locale}]`;
      await openPractice(page, base, 'u09-ladder');
      await toCorner(page);
      const prompt = await page.getByTestId('practice-prompt').innerText();
      check(
        `${L} ladder-play-corner is on screen`,
        prompt.includes(s['lesson.u09-ladder.e9.prompt']),
      );

      // A: start.
      await fits(page, `${L} A start`, [...CONTROLS, 'practice-hint']);
      await shot(page, `23-corner-A-start-${locale}`);

      // B: mid-ladder (after e6 f5 g5 f6), Move 3 of 4.
      for (const at of ['e6', 'g5']) {
        await tap(page, at, 7);
        await wait(page, 700);
      }
      const progressLabel = s['sequence.progress'].replace('{{n}}', '3').replace('{{m}}', '4');
      check(
        `${L} B progress "${progressLabel}"`,
        (await page.getByTestId('sequence-progress').innerText()).includes(progressLabel),
      );
      await fits(page, `${L} B mid-ladder`, [...CONTROLS, 'practice-hint']);
      await shot(page, `23-corner-B-mid-${locale}`);

      // C: the slow atari g6: the reply f7, dashed ring, two facts, Undo.
      await tap(page, 'g6', 7);
      await wait(page, 700);
      const feedback = await page.getByTestId('practice-feedback').innerText();
      check(`${L} C atari fact`, feedback.includes(s['sequence.wrong.atariButEscapes']));
      const after = s['sequence.wrong.afterReply_other'].replace('{{count}}', '2');
      check(`${L} C reply fact`, feedback.includes(after), feedback.replace(/\n/g, ' / '));
      const card = await page.getByTestId('practice-feedback').evaluate((el) => {
        const box = el.getBoundingClientRect();
        const inner = el.firstElementChild?.firstElementChild?.getBoundingClientRect();
        return { height: box.height, content: inner ? inner.height : 0 };
      });
      check(
        `${L} C two lines fit the feedback card`,
        card.content <= card.height + 0.5,
        `${card.content.toFixed(0)} / ${card.height.toFixed(0)} px`,
      );
      await fits(page, `${L} C wrong`, [...CONTROLS, 'sequence-undo']);
      await shot(page, `23-corner-C-wrong-${locale}`);

      // D: Undo, then f7 (W g6) and g7 captures.
      await press(page, 'sequence-undo');
      await tap(page, 'f7', 7);
      await wait(page, 700);
      await tap(page, 'g7', 7);
      await wait(page, 700);
      const done = await page.getByTestId('practice-feedback').innerText();
      const captured = s['sequence.captured_other'].replace('{{count}}', '4');
      check(`${L} D solved, 4 captured`, done.includes(captured), done.replace(/\n/g, ' / '));
      await fits(page, `${L} D solved`, [...CONTROLS, 'practice-finish']);
      await shot(page, `23-corner-D-solved-${locale}`);
      await context.close();
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
  console.log('\nAll M5 sequence v2 web checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
