#!/usr/bin/env node
// M3 web verification (spec docs/specs/M3-lesson-framework.md ACs 107, 110, 111).
//
// Exports the web build with the developer sample lesson (EXPO_PUBLIC_DEV_LESSONS=1, since a
// release export hides unit 0), serves it statically and drives it in Chromium at 360×740:
// home → sample lesson (3 steps) → practice (6 exercises) → result → reload (progress kept).
// Screenshots go to docs/screenshots/M3/. Exits non-zero on any failed check.
//
//   npm run verify:web:m3              # always re-exports dist/ first
//   npm run verify:web:m3 -- --reuse   # reuse dist/ (must have been exported with the flag)
//
// Environment: CHROMIUM_PATH, PLAYWRIGHT_PATH (as for scripts/verify-web.mjs).
// Not part of Jest or CI: it needs a browser. Selectors use test IDs, so every locale works.

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'docs', 'screenshots', 'M3');
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VIEWPORT = { width: 360, height: 740 };
const COLUMNS = 'abcdefghjklmnopqrst'; // lesson notation, no "i"

function strings(locale) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'i18n', `${locale}.json`), 'utf8'));
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    'playwright',
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
  console.log('Exporting the web build with the sample lesson…');
  const result = spawnSync('npx', ['expo', 'export', '--platform', 'web'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, EXPO_OFFLINE: '1', CI: '1', EXPO_PUBLIC_DEV_LESSONS: '1' },
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

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function noHorizontalScroll(page, where) {
  const width = await page.evaluate(() => document.scrollingElement.scrollWidth);
  check(`${where}: no horizontal scroll`, width <= VIEWPORT.width, `scrollWidth=${width}`);
}

/** Touch-down + touch-up on a vertex of the practice board (coordinates hidden: margin 1). */
async function tap(page, vertex, size = 5) {
  const board = page.getByTestId('practice-board').last();
  const box = await board.boundingBox();
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

async function feedback(page) {
  return (await page.getByTestId('practice-feedback').innerText()).trim();
}

async function main() {
  exportWeb();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS)) if (f.endsWith('.png')) fs.rmSync(path.join(SHOTS, f));
  const en = strings('en');

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      locale: 'en',
    });
    const page = await context.newPage();
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror ${e.message}`));

    // --- Home (AC 97, 107) ---
    await page.goto(base);
    await page.getByTestId('home-continue').waitFor({ timeout: 30000 });
    await page.waitForTimeout(400);
    const cont = await page.getByTestId('home-continue').boundingBox();
    const second = await page.getByTestId('home-node-unit-1').boundingBox();
    check(
      'AC107 Continue and the first two nodes visible without scrolling',
      cont.y >= 0 && second.y + second.height <= VIEWPORT.height,
      `node 2 bottom=${(second.y + second.height).toFixed(0)}`,
    );
    await noHorizontalScroll(page, 'home');
    await shot(page, '01-home');

    // --- Explanation player (AC 45–48) ---
    await page.getByTestId('home-node-unit-0').click();
    await page.getByTestId('lesson-board').waitFor();
    await page.waitForTimeout(300);
    check(
      'explain: step 1 text',
      (await page.getByTestId('lesson-text').innerText()).includes(en['lesson.u00-sample.s1']),
    );
    await press(page, 'lesson-next');
    await page.waitForTimeout(1000);
    check('AC46 step 2: c3 captured', (await page.getByTestId('board-stone-c3').count()) === 0);
    check('AC46 step 2: B c4 played', (await page.getByTestId('board-stone-c4').count()) === 1);
    await noHorizontalScroll(page, 'explain');
    await shot(page, '02-explain-step2');
    await press(page, 'lesson-next');
    await page.waitForTimeout(1000);
    await press(page, 'lesson-start-practice');
    await page.getByTestId('practice-board').waitFor();
    await page.waitForTimeout(300);

    // --- Runners (AC 68–88) ---
    await tap(page, 'c4');
    check('tap-point (one): correct', (await feedback(page)).startsWith(en['fb.correct']));
    await shot(page, '03-tap-point');
    await press(page, 'practice-next');

    for (const v of ['b1', 'd1', 'c2']) await tap(page, v);
    await press(page, 'practice-check');
    check('tap-point (all): correct', (await feedback(page)).startsWith(en['fb.correct']));
    await press(page, 'practice-next');

    await tap(page, 'c3');
    check(
      'play-move: c3 → nothing captured',
      (await feedback(page)).startsWith(en['fb.pm.noCapture']),
    );
    await press(page, 'practice-try-again');
    await tap(page, 'd3');
    check('play-move: d3 captures', (await feedback(page)).startsWith(en['fb.correct']));
    await shot(page, '04-play-move');
    await press(page, 'practice-next');

    await tap(page, 'c3');
    check('play-move (connect): correct', (await feedback(page)).startsWith(en['fb.correct']));
    await press(page, 'practice-next');

    await press(page, 'practice-option-0');
    await shot(page, '05-choice');
    await press(page, 'practice-option-2');
    check('choice: correct after one wrong', (await feedback(page)).startsWith(en['fb.correct']));
    await press(page, 'practice-next');

    await press(page, 'practice-chip-5');
    await press(page, 'practice-check');
    check('count: 5 is correct', (await feedback(page)).startsWith(en['fb.correct']));
    await noHorizontalScroll(page, 'count');
    await shot(page, '06-count');
    await press(page, 'practice-finish');

    // --- Result (AC 89–91) ---
    await page.getByTestId('result-stars').waitFor();
    await page.waitForTimeout(1200);
    // 4 first-try + 2 solved after a mistake (play-move e3, choice) → 2★
    const filled = await page.getByTestId('result-star-filled').count();
    check('result: 2 stars (4 of 6 first try)', filled === 2, `filled=${filled}`);
    await shot(page, '07-result');

    // --- Persistence (AC 111) ---
    await press(page, 'result-map');
    await page.waitForTimeout(400);
    await page.reload();
    await page.getByTestId('home-node-unit-0').waitFor({ timeout: 30000 });
    await page.waitForTimeout(400);
    const labelAfterReload = await page.getByTestId('home-node-unit-0').getAttribute('aria-label');
    check(
      'AC111 progress kept after reload',
      /2 of 3 stars/.test(labelAfterReload ?? ''),
      labelAfterReload ?? '',
    );
    await shot(page, '08-home-after-reload');
    await context.close();

    // --- Home in zh-CN and fr (no horizontal scroll) ---
    for (const locale of ['zh-CN', 'fr']) {
      const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale });
      const p = await ctx.newPage();
      p.on('console', (m) => m.type() === 'error' && consoleErrors.push(`[${locale}] ${m.text()}`));
      await p.goto(base);
      await p.getByTestId('home-continue').waitFor({ timeout: 30000 });
      await p.waitForTimeout(400);
      check(
        `[${locale}] UI is in ${locale}`,
        (await p.locator('body').innerText()).includes(strings(locale)['home.path.title']),
      );
      await noHorizontalScroll(p, `[${locale}] home`);
      await shot(p, `09-home-${locale}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  check(
    'AC111 zero console errors',
    consoleErrors.length === 0,
    consoleErrors.slice(0, 5).join(' | '),
  );
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll M3 web checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
