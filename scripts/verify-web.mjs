#!/usr/bin/env node
// M2 web verification (spec docs/specs/M2-board-ui.md §6 H, ACs 57–60).
//
// Exports the web build (or reuses an up-to-date `dist/`), serves it statically, drives
// `/dev/board` in Chromium at 360×740 (DPR 2) and saves the 9 screenshots of AC 59 to
// `docs/screenshots/M2/`. Exits non-zero on any failed check.
//
//   npm run verify:web               # reuse dist/ when it is newer than the sources
//   npm run verify:web -- --rebuild  # always run `expo export --platform web` first
//
// Environment:
//   CHROMIUM_PATH  Chromium executable (default /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
//   PLAYWRIGHT_PATH  directory of the `playwright` package (default: local, then global npm root)
//
// Not part of Jest or CI: it needs a browser. Selectors use test IDs only, so every locale works.

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'docs', 'screenshots', 'M2');
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VIEWPORT = { width: 360, height: 740 };
const BOARD_X = 16;
const BOARD_WIDTH = 328;
const COLUMNS = 'ABCDEFGHJKLMNOPQRST'; // Go coordinates skip I

/** Expected copy, read from the app's own i18n files so the checks follow the translations. */
function strings(locale) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'i18n', `${locale}.json`), 'utf8'));
}

// ---------------------------------------------------------------------------------------------
// Playwright: resolved from the project, then from the global npm install (no devDependency).

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    'playwright',
    (() => {
      try {
        const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
        return path.join(globalRoot, 'playwright');
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
  throw new Error(
    'Playwright not found. Install it globally (npm i -g playwright) or set PLAYWRIGHT_PATH.',
  );
}

// ---------------------------------------------------------------------------------------------
// Build + static server

function newestMtime(target) {
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return stat.mtimeMs;
  let newest = 0;
  for (const entry of fs.readdirSync(target)) {
    newest = Math.max(newest, newestMtime(path.join(target, entry)));
  }
  return newest;
}

function ensureWebBuild() {
  const index = path.join(DIST, 'index.html');
  const sources = ['app', 'src', 'assets', 'app.json', 'package.json'].map((p) =>
    path.join(ROOT, p),
  );
  const fresh =
    fs.existsSync(index) &&
    fs.statSync(index).mtimeMs > Math.max(...sources.filter(fs.existsSync).map(newestMtime));
  if (fresh && !process.argv.includes('--rebuild')) {
    console.log('Reusing dist/ (newer than the sources).');
    return;
  }
  console.log('Exporting the web build (npx expo export --platform web)…');
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
      // expo-router single-page fallback: unknown routes get the shell
      const html = `${file}.html`;
      file = html.startsWith(DIST) && fs.existsSync(html) ? html : path.join(DIST, 'index.html');
    }
    res.setHeader('content-type', MIME[path.extname(file)] ?? 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// ---------------------------------------------------------------------------------------------
// Checks

const failures = [];
const consoleErrors = [];

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
}

/** Page position of a vertex such as "e5" (spec §4.1 / AC 6 geometry, coordinates shown). */
function vertexPosition(box, size, vertex) {
  const margin = size >= 13 ? 1.2 : 1.0;
  const cell = box.width / (size - 1 + 2 * margin);
  const col = COLUMNS.indexOf(vertex[0].toUpperCase());
  const rowFromTop = size - Number(vertex.slice(1));
  return {
    x: box.x + (margin + col) * cell,
    y: box.y + (margin + rowFromTop) * cell,
    svg: { x: (margin + col) * cell, y: (margin + rowFromTop) * cell },
    cell,
  };
}

async function openBoard(browser, locale) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[${locale}] ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`[${locale}] pageerror ${e.message}`));
  await page.goto(`${baseUrl}/dev/board`);
  await page.getByTestId('go-board').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(500); // fonts + first layout
  return { context, page };
}

async function boardBox(page) {
  return page.getByTestId('go-board').first().boundingBox();
}

async function count(page, testId) {
  return page.getByTestId(testId).count();
}

async function tap(page, point) {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up();
}

async function chooseScenario(page, id) {
  await page.getByTestId(`board-demo-scenario-${id}`).click();
  await page.waitForTimeout(300);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function playForbidden(page, locale) {
  await chooseScenario(page, 'forbidden');
  const a1 = vertexPosition(await boardBox(page), 5, 'a1');
  await tap(page, a1);
  const message = page.getByTestId('board-demo-message');
  await message.waitFor({ state: 'visible', timeout: 2000 });
  const text = (await message.innerText()).trim();
  check(
    `[${locale}] Forbidden: White a1 shows the suicide message`,
    text === strings(locale)['engine.illegal.suicide'],
    text,
  );
  check(`[${locale}] Forbidden: no stone at a1`, (await count(page, 'board-stone-a1')) === 0);
}

async function checkLocale(page, locale) {
  const body = await page.locator('body').innerText();
  check(`[${locale}] UI is in ${locale}`, body.includes(strings(locale)['dev.board.title']));
}

// ---------------------------------------------------------------------------------------------

let baseUrl = '';

async function main() {
  ensureWebBuild();

  const server = await serve();
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  // Start from an empty folder so the AC 59 count is exact (only once the browser is up).
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS)) if (f.endsWith('.png')) fs.rmSync(path.join(SHOTS, f));

  try {
    // --- en: ACs 57, 58 and screenshots 01–07 ---
    {
      const { context, page } = await openBoard(browser, 'en');
      await checkLocale(page, 'en');

      // AC 57 — geometry and no horizontal scroll
      const box = await boardBox(page);
      check(
        'AC57 board x = 16 ± 1, width = 328 ± 1',
        Math.abs(box.x - BOARD_X) <= 1 && Math.abs(box.width - BOARD_WIDTH) <= 1,
        `x=${box.x.toFixed(1)} width=${box.width.toFixed(1)}`,
      );
      check(
        'AC57 board fully in the viewport',
        box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= VIEWPORT.width &&
          box.y + box.height <= VIEWPORT.height,
        `y=${box.y.toFixed(1)} bottom=${(box.y + box.height).toFixed(1)}`,
      );
      const scrollWidth = await page.evaluate(() => document.scrollingElement.scrollWidth);
      check('AC57 scrollWidth ≤ 360', scrollWidth <= VIEWPORT.width, `scrollWidth=${scrollWidth}`);
      await shot(page, '01-empty-9x9');

      // AC 58 — press shows a ghost, release plays a stone with the last-move dot
      const e5 = vertexPosition(box, 9, 'e5');
      await page.mouse.move(e5.x, e5.y);
      await page.mouse.down();
      await page.waitForTimeout(150);
      check('AC58 ghost visible while pressed at e5', (await count(page, 'board-ghost')) === 1);
      check('AC58 no stone yet while pressed', (await count(page, 'board-stone-e5')) === 0);
      await shot(page, '02-preview-e5');
      await page.mouse.up();
      await page.waitForTimeout(400);
      check('AC58 ghost gone after release', (await count(page, 'board-ghost')) === 0);
      check('AC58 black stone at e5', (await count(page, 'board-stone-e5')) === 1);
      const dotX = Number(await page.getByTestId('board-last-move').getAttribute('cx'));
      const dotY = Number(await page.getByTestId('board-last-move').getAttribute('cy'));
      check(
        'AC58 last-move dot at e5',
        Math.abs(dotX - e5.svg.x) < 1.5 && Math.abs(dotY - e5.svg.y) < 1.5,
        `cx=${dotX.toFixed(1)} cy=${dotY.toFixed(1)}`,
      );
      await shot(page, '03-played-e5');

      // 04 — Capture: Black c4 captures c3; screenshot 400 ms after the click
      await chooseScenario(page, 'capture');
      const c4 = vertexPosition(await boardBox(page), 5, 'c4');
      await tap(page, c4);
      await page.waitForTimeout(400);
      check('Capture: c3 removed, c4 played', (await count(page, 'board-stone-c3')) === 0);
      check('Capture: black stone at c4', (await count(page, 'board-stone-c4')) === 1);
      await shot(page, '04-capture');

      // 05 — Forbidden point message
      await playForbidden(page, 'en');
      await shot(page, '05-forbidden');

      // 06 — 19×19, mouse held at k10
      await page.getByTestId('board-demo-size-19').click();
      await page.waitForTimeout(300);
      const k10 = vertexPosition(await boardBox(page), 19, 'k10');
      await page.mouse.move(k10.x, k10.y);
      await page.mouse.down();
      await page.waitForTimeout(150);
      check('19×19: ghost visible at k10', (await count(page, 'board-ghost')) === 1);
      check('19×19: coordinate tag visible', (await count(page, 'board-coord-tag')) === 1);
      await shot(page, '06-19x19-preview');
      await page.mouse.up();
      await page.waitForTimeout(300);
      check('19×19: stone at k10 after release', (await count(page, 'board-stone-k10')) === 1);

      // 07 — Markers scenario
      await chooseScenario(page, 'markers');
      check(
        'Markers: static markers shown',
        (await page.locator('[data-testid^="board-marker-"]').count()) > 0,
      );
      await shot(page, '07-markers');

      const width = await page.evaluate(() => document.scrollingElement.scrollWidth);
      check('AC57 scrollWidth ≤ 360 at the end of the en run', width <= VIEWPORT.width);
      await context.close();
    }

    // --- zh-CN: empty 9×9 ---
    {
      const { context, page } = await openBoard(browser, 'zh-CN');
      await checkLocale(page, 'zh-CN');
      const box = await boardBox(page);
      check(
        'zh-CN board x = 16 ± 1, width = 328 ± 1',
        Math.abs(box.x - BOARD_X) <= 1 && Math.abs(box.width - BOARD_WIDTH) <= 1,
        `x=${box.x.toFixed(1)} width=${box.width.toFixed(1)}`,
      );
      const scrollWidth = await page.evaluate(() => document.scrollingElement.scrollWidth);
      check('zh-CN scrollWidth ≤ 360', scrollWidth <= VIEWPORT.width, `scrollWidth=${scrollWidth}`);
      await shot(page, '08-zh-CN-empty-9x9');
      await context.close();
    }

    // --- fr: Forbidden point ---
    {
      const { context, page } = await openBoard(browser, 'fr');
      await checkLocale(page, 'fr');
      await playForbidden(page, 'fr');
      const scrollWidth = await page.evaluate(() => document.scrollingElement.scrollWidth);
      check('fr scrollWidth ≤ 360', scrollWidth <= VIEWPORT.width, `scrollWidth=${scrollWidth}`);
      await shot(page, '09-fr-forbidden');
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  // AC 60 — zero console errors during the whole run (audio included)
  check(
    'AC60 zero console errors',
    consoleErrors.length === 0,
    consoleErrors.slice(0, 5).join(' | '),
  );

  const saved = fs.readdirSync(SHOTS).filter((f) => f.endsWith('.png'));
  check('AC59 exactly 9 screenshots saved', saved.length === 9, saved.join(', '));

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll web checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
