#!/usr/bin/env node
// M4 web verification (spec docs/specs/M4-content-units-1-5.md ACs 19–23).
//
// Exports the release web build (no developer sample), serves it and drives it in Chromium at
// 360×740 in en, fr and zh-CN:
//   - home map: no horizontal scroll; the "coming soon" badge sits under the Unit 6 title (AC 19–21);
//   - every explanation step of units 1–5: the text is not cut off (AC 22, screenshot of the
//     longest step per lesson and language);
//   - labelled stones in choice exercises (u02-liberties #5, u03-connection #3) (AC 23).
// Screenshots go to docs/screenshots/M4/. Exits non-zero on any failed check.
//
//   npm run verify:web:m4              # always re-exports dist/ first
//   npm run verify:web:m4 -- --reuse   # reuse dist/ (must be a release export)
//
// Not part of Jest or CI: it needs a browser.

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'docs', 'screenshots', 'M4');
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

const LOCALES = ['en', 'fr', 'zh-CN'];
const LESSONS = ['u01-board', 'u02-liberties', 'u03-connection', 'u04-capture', 'u05-atari'];

/** Progress with 1★ on units 1–4 (Unit 5 open, the review still locked). */
function seededProgress() {
  const entry = {
    stars: 1,
    plays: 1,
    bestClean: 4,
    bestSolved: 4,
    total: 8,
    lastPlayedAt: '2026-10-16T00:00:00.000Z',
  };
  const lessons = Object.fromEntries(LESSONS.slice(0, 4).map((id) => [id, entry]));
  return JSON.stringify({ v: 1, lessons });
}

async function newPage(browser, locale, progress) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale });
  if (progress) {
    await context.addInitScript(
      (value) => window.localStorage.setItem('progress', value),
      progress,
    );
  }
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`[${locale}] ${m.text()}`));
  page.on('pageerror', (e) => consoleErrors.push(`[${locale}] pageerror ${e.message}`));
  return { context, page };
}

async function textFits(page) {
  return page.getByTestId('lesson-text').evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
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
    // --- Home map (AC 19–21) ---
    for (const locale of LOCALES) {
      const s = strings(locale);
      const { context, page } = await newPage(browser, locale);
      await page.goto(base);
      await page.getByTestId('home-continue').waitFor({ timeout: 30000 });
      await page.waitForTimeout(400);
      check(
        `[${locale}] home in ${locale}`,
        (await page.locator('body').innerText()).includes(s['home.path.title']),
      );
      await noHorizontalScroll(page, `[${locale}] home`);
      await shot(page, `01-home-${locale}`);

      const node = page.getByTestId('home-node-unit-6');
      await node.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const card = await node.boundingBox();
      const badge = await page.getByTestId('home-badge-unit-6').boundingBox();
      const title = await page.getByText(s['unit.6.title'], { exact: true }).boundingBox();
      check(
        `[${locale}] AC19 badge under the title`,
        badge.y >= title.y + title.height - 1,
        `badge.y=${badge.y.toFixed(0)} title.bottom=${(title.y + title.height).toFixed(0)}`,
      );
      check(
        `[${locale}] AC19 badge and title inside the card`,
        badge.y + badge.height <= card.y + card.height &&
          title.x + title.width <= card.x + card.width + 1,
      );
      check(`[${locale}] AC19 card ≥ 72 px`, card.height >= 72, `h=${card.height.toFixed(0)}`);
      for (let n = 1; n <= 5; n++) {
        const t = page.getByText(s[`unit.${n}.title`], { exact: true });
        const fits = await t.evaluate(
          (el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1,
        );
        check(`[${locale}] AC20 unit ${n} title not cut`, fits);
      }
      if (locale === 'zh-CN') {
        check(
          '[zh-CN] AC21 checkpoint row reads 综合复习',
          (await page.getByTestId('home-node-checkpoint-5').innerText()).includes('综合复习'),
        );
      }
      await noHorizontalScroll(page, `[${locale}] home bottom`);
      await shot(page, `02-home-bottom-${locale}`);
      await context.close();
    }

    // --- Explanation steps (AC 22) ---
    for (const locale of LOCALES) {
      const s = strings(locale);
      const { context, page } = await newPage(browser, locale, seededProgress());
      for (const id of LESSONS) {
        await page.goto(`${base}/lesson/${id}`);
        await page.getByTestId('lesson-board').waitFor({ timeout: 30000 });
        await page.waitForTimeout(300);
        let longest = { len: -1, step: 0 };
        for (let step = 1; ; step++) {
          const text = s[`lesson.${id}.s${step}`] ?? '';
          await page.waitForTimeout(250);
          check(`[${locale}] AC22 ${id} step ${step} text shown in full`, await textFits(page));
          if ([...text].length > longest.len) longest = { len: [...text].length, step };
          if ((await page.getByTestId('lesson-next').count()) === 0) break;
          await press(page, 'lesson-next');
        }
        // Go back to the longest step for its screenshot.
        const steps = await page
          .getByTestId('lesson-dots')
          .evaluate((el) => el.children.length)
          .catch(() => 0);
        for (let k = steps || 0; k > longest.step; k--) {
          if ((await page.getByTestId('lesson-back').count()) === 0) break;
          await press(page, 'lesson-back');
        }
        await page.waitForTimeout(1200);
        await noHorizontalScroll(page, `[${locale}] ${id}`);
        await shot(page, `03-${id}-step${longest.step}-${locale}`);
      }
      await context.close();
    }

    // --- Labelled stones in choice exercises (AC 23) ---
    {
      const { context, page } = await newPage(browser, 'en', seededProgress());
      await page.goto(`${base}/practice/u03-connection`);
      await page.getByTestId('practice-board').waitFor({ timeout: 30000 });
      await page.waitForTimeout(300);
      await press(page, 'practice-option-0');
      await press(page, 'practice-next');
      await press(page, 'practice-option-1');
      await press(page, 'practice-next');
      await page.waitForTimeout(300);
      await shot(page, '04-u03-connection-ex3-labels');

      await page.goto(`${base}/practice/u02-liberties`);
      await page.getByTestId('practice-board').waitFor({ timeout: 30000 });
      await page.waitForTimeout(300);
      for (const v of ['c3', 'd2', 'd4', 'e3']) await tap(page, v);
      await press(page, 'practice-check');
      check(
        'u02 #1 tap all liberties: correct',
        (await feedback(page)).startsWith(strings('en')['fb.correct']),
      );
      await press(page, 'practice-next');
      await press(page, 'practice-chip-3');
      await press(page, 'practice-check');
      await press(page, 'practice-next');
      for (const v of ['a2', 'b1']) await tap(page, v);
      await press(page, 'practice-check');
      await press(page, 'practice-next');
      await press(page, 'practice-chip-2');
      await press(page, 'practice-check');
      await press(page, 'practice-next');
      await page.waitForTimeout(300);
      await shot(page, '05-u02-liberties-ex5-labels');
      await press(page, 'practice-option-2');
      check(
        'u02 #5 choice C: correct',
        (await feedback(page)).startsWith(strings('en')['fb.correct']),
      );
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
  console.log('\nAll M4 web checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
