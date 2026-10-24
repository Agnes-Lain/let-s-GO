#!/usr/bin/env node
// M5 item 1 web verification (spec docs/specs/M5-ko-forbidden-ladders.md ACs 38–41).
//
// Exports the release web build, serves it and drives it in Chromium at 360×740 in en, fr, zh-CN:
//   - home map: Units 7–10 titles in full, the planned unit (12 since M5 item 3) "coming soon";
//   - every explanation step of Units 7–9 shows its text in full (AC 38; screenshots of step 1 and
//     of the longest step);
//   - one exercise of every lesson, the A/B labels of u09 #2 and u09-review #7 (AC 41);
//   - the 7×7 cell size with coordinates (AC 39: reported, not failed);
//   - u08 #6: tapping the ko point c4 shows the ko sentence in full, no scroll (AC 26, 40).
// Screenshots go to docs/screenshots/M5/. Exits non-zero on any failed check.
//
//   npm run verify:web:m5              # always re-exports dist/ first
//   npm run verify:web:m5 -- --reuse   # reuse dist/ (must be a release export)
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
const LESSONS = ['u07-forbidden', 'u08-ko', 'u09-ladder'];

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

async function noHorizontalScroll(page, where) {
  const width = await page.evaluate(() => document.scrollingElement.scrollWidth);
  check(`${where}: no horizontal scroll`, width <= VIEWPORT.width, `scrollWidth=${width}`);
}

/** Touch-down + touch-up on a vertex of a practice board WITH coordinates (margin 1 cell). */
async function tap(page, vertex, size = 5) {
  const box = await page.getByTestId('practice-board').last().boundingBox();
  const cell = box.width / (size + 1);
  const x = box.x + (1 + COLUMNS.indexOf(vertex[0])) * cell;
  const y = box.y + (1 + size - Number(vertex.slice(1))) * cell;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(350);
}

async function press(page, testId) {
  await page.getByTestId(testId).click();
  await page.waitForTimeout(250);
}

const feedback = async (page) => (await page.getByTestId('practice-feedback').innerText()).trim();

/** 1★ on Units 1–9 lessons and checkpoints up to Unit 6: every M5 node is open. */
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

async function main() {
  exportWeb();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  fs.mkdirSync(SHOTS, { recursive: true });
  // Only this script's screenshots (01-* … 08-*); 2x-* belong to verify:web:m5c.
  for (const f of fs.readdirSync(SHOTS)) {
    if (/^0\d-.*\.png$/.test(f)) fs.rmSync(path.join(SHOTS, f));
  }

  try {
    for (const locale of LOCALES) {
      const s = strings(locale);
      const { context, page } = await newPage(browser, locale);

      // --- Home map: Units 7–9 (and, since M5 item 3, Unit 12 "coming soon") ---
      await page.goto(`${base}/learn`);
      await page.getByTestId('home-continue').waitFor({ timeout: 30000 });
      // M6-settings: Home groups rows in collapsible modules; open them all.
      for (const n of [1, 2, 3])
        if ((await page.getByTestId(`home-module-${n}-rows`).count()) === 0)
          await page.getByTestId(`home-module-${n}`).click();
      const soon = page.getByTestId('home-node-unit-12');
      await soon.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      for (const n of [7, 8, 9, 10]) {
        const fits = await page
          .getByText(s[`unit.${n}.title`], { exact: true })
          .evaluate(
            (el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1,
          );
        check(`[${locale}] unit ${n} title not cut`, fits);
      }
      check(
        `[${locale}] Unit 12 shows "coming soon"`,
        (await soon.innerText()).includes(s['home.unit.comingSoon']),
      );
      await noHorizontalScroll(page, `[${locale}] home`);
      await shot(page, `01-home-units-7-10-${locale}`);

      // --- Explanation steps (AC 38) ---
      for (const id of LESSONS) {
        await page.goto(`${base}/lesson/${id}`);
        await page.getByTestId('lesson-board').waitFor({ timeout: 30000 });
        await page.waitForTimeout(1500);
        await shot(page, `02-${id}-step1-${locale}`);
        let longest = { len: -1, step: 1 };
        let steps = 0;
        for (let step = 1; ; step++) {
          steps = step;
          const text = s[`lesson.${id}.s${step}`] ?? '';
          await page.waitForTimeout(250);
          const fits = await page
            .getByTestId('lesson-text')
            .evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
          check(`[${locale}] AC38 ${id} step ${step} text shown in full`, fits);
          if ([...text].length > longest.len) longest = { len: [...text].length, step };
          if ((await page.getByTestId('lesson-next').count()) === 0) break;
          await press(page, 'lesson-next');
        }
        for (let k = steps; k > longest.step; k--) await press(page, 'lesson-back');
        await page.waitForTimeout(2500);
        await noHorizontalScroll(page, `[${locale}] ${id}`);
        await shot(page, `03-${id}-longest-step${longest.step}-${locale}`);
      }

      // --- One exercise per lesson; labels A/B (AC 41) ---
      await openPractice(page, base, 'u07-forbidden');
      await shot(page, `04-u07-forbidden-ex1-${locale}`);
      await openPractice(page, base, 'u09-ladder');
      await press(page, 'practice-chip-2');
      await press(page, 'practice-check');
      await press(page, 'practice-next');
      await page.waitForTimeout(400);
      await shot(page, `05-u09-ladder-ex2-labels-${locale}`);
      await openPractice(page, base, 'u09-review');
      await shot(page, `06-u09-review-ex1-${locale}`);

      // --- u08 #6: the ko refusal (AC 26, 40) ---
      await openPractice(page, base, 'u08-ko');
      await shot(page, `07-u08-ko-ex1-${locale}`);
      await tap(page, 'c4');
      await press(page, 'practice-next');
      await press(page, 'practice-option-1');
      await press(page, 'practice-next');
      await tap(page, 'c3');
      await press(page, 'practice-next');
      await press(page, 'practice-option-1');
      await press(page, 'practice-next');
      await press(page, 'practice-option-0');
      await press(page, 'practice-next');
      await page.waitForTimeout(400);
      const board = await page.getByTestId('practice-board').last().boundingBox();
      const cell = board.width / 8;
      console.log(
        `INFO  [${locale}] AC39 7×7 with coordinates: board ${board.width.toFixed(0)} px, cell ${cell.toFixed(1)} px`,
      );
      await tap(page, 'c4', 7);
      const text = await feedback(page);
      check(`[${locale}] AC26 ko sentence`, text === s['engine.illegal.ko'].trim(), text);
      check(
        `[${locale}] AC26 the board did not change`,
        (await page.getByTestId('board-stone-c4').count()) === 0,
      );
      const { width, height, cut } = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="practice-feedback"]');
        const r = el.getBoundingClientRect();
        return {
          width: document.scrollingElement.scrollWidth,
          height: document.scrollingElement.scrollHeight,
          cut: el.scrollHeight > el.clientHeight + 1 || r.bottom > window.innerHeight,
        };
      });
      check(
        `[${locale}] AC40 feedback in full, no scroll`,
        !cut && width <= VIEWPORT.width && height <= VIEWPORT.height,
        `${width}×${height}`,
      );
      await shot(page, `08-u08-ko-ex6-ko-refused-${locale}`);
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
  console.log('\nAll M5 web checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
