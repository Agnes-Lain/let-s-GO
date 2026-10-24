#!/usr/bin/env node
// M5 item 3 web verification (spec docs/specs/M5-life-death.md AC 29, 36, 39, 41–43, 50).
//
// Exports the release web build, serves it and drives it in Chromium at 360×740 in en, fr, zh-CN:
//   - home map: Units 10–11 titles in full, Unit 12 "coming soon" (20-home-*);
//   - the sequence runner's four mockup states on u11-vital "kill-straight": A hint open,
//     B opponent replying, C refuted first move, D solved (20-sequence-*), nothing scrolls (AC 29);
//   - the layout rule: explanation text above the board, prompt → board → feedback for every
//     exercise type, the Capture Go goal card on top, every control on screen (21-*, AC 39–43);
//   - the lighter bamboo board on a 9×9 position, after and (recoloured to the old tokens) before
//     (22-*, AC 50).
// Screenshots go to docs/screenshots/M5/ (only 20-*, 21-*, 22-* are replaced). Exits non-zero on any
// failed check.
//
//   npm run verify:web:m5c              # always re-exports dist/ first
//   npm run verify:web:m5c -- --reuse   # reuse dist/ (must be a release export)
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
/** M5 §5.7: new token → the value before M5 (for the "before" crop). */
const OLD_COLOURS = {
  '#ebd8a8': '#EEDCAE',
  '#e3cd98': '#DEC68C',
  '#ddc690': '#CDB277',
  '#6b675c': '#8F8C80',
};

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

const top = async (page, testId) => (await page.getByTestId(testId).last().boundingBox())?.y ?? -1;

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

/** Top-to-bottom order of elements (AC 39, 41, 42). */
async function ordered(page, where, ids) {
  const ys = [];
  for (const id of ids) ys.push(await top(page, id));
  const ok = ys.every((y, i) => y >= 0 && (i === 0 || y > ys[i - 1]));
  check(`${where}: ${ids.join(' < ')}`, ok, ys.map((y) => y.toFixed(0)).join(' < '));
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

const EXERCISE_CONTROLS = [
  'practice-close',
  'practice-prompt',
  'practice-board',
  'practice-feedback',
];

async function main() {
  exportWeb();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS)) {
    if (/^2[0-2]-.*\.png$/.test(f)) fs.rmSync(path.join(SHOTS, f));
  }

  try {
    for (const locale of LOCALES) {
      const s = strings(locale);
      const { context, page } = await newPage(browser, locale);
      const L = `[${locale}]`;

      // --- Home map: Units 10–11, Unit 12 "coming soon" ---
      await page.goto(`${base}/learn`);
      await page.getByTestId('home-continue').waitFor({ timeout: 30000 });
      // M6-settings: Home groups rows in collapsible modules; open them all.
      for (const n of [1, 2, 3])
        if ((await page.getByTestId(`home-module-${n}-rows`).count()) === 0)
          await page.getByTestId(`home-module-${n}`).click();
      const soon = page.getByTestId('home-node-unit-12');
      await soon.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      for (const key of ['unit.10.title', 'unit.11.title', 'lesson.u11-vital.title']) {
        const ok = await page
          .getByText(s[key], { exact: true })
          .first()
          .evaluate(
            (el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1,
          );
        check(`${L} ${key} not cut`, ok);
      }
      check(
        `${L} Unit 12 shows "coming soon"`,
        (await soon.innerText()).includes(s['home.unit.comingSoon']),
      );
      await shot(page, `20-home-units-10-12-${locale}`);

      // --- Explanation steps: text card above the board (AC 39, 40, 43) ---
      for (const id of ['u10-eyes', 'u11-two-eyes', 'u11-vital']) {
        await page.goto(`${base}/lesson/${id}`);
        await page.getByTestId('lesson-board').waitFor({ timeout: 30000 });
        await page.waitForTimeout(1500);
        await ordered(page, `${L} AC39 ${id}`, [
          'lesson-text-card',
          'lesson-board-area',
          'lesson-next',
        ]);
        const card = await page.getByTestId('lesson-text-card').boundingBox();
        check(
          `${L} AC40 ${id} text card 120 px (§12b)`,
          Math.round(card.height) === 120,
          `${card.height}`,
        );
        await fits(page, `${L} AC43 ${id} step 1`, ['lesson-close', 'lesson-next']);
        await shot(page, `21-${id}-step1-${locale}`);
        // AC 40 (§12b): every step's text is shown in full in the 120 px card.
        for (let step = 1; ; step++) {
          const scrolls = await page.getByTestId('lesson-text').evaluate((el) => {
            const card = el.closest('[data-testid="lesson-text-card"]').getBoundingClientRect();
            return el.getBoundingClientRect().height > card.height - 24 + 1; // 12 px padding
          });
          check(`${L} AC40 ${id} step ${step} text in full`, !scrolls);
          if ((await page.getByTestId('lesson-next').count()) === 0) break;
          await press(page, 'lesson-next');
        }
      }

      // --- Exercises of every type (AC 41, 43) ---
      await openPractice(page, base, 'u10-eyes');
      await ordered(page, `${L} AC41 tap-point`, [
        'practice-prompt',
        'practice-board',
        'practice-feedback',
      ]);
      await fits(page, `${L} AC43 tap-point 5×5`, EXERCISE_CONTROLS);
      await shot(page, `21-u10-eyes-ex1-tap-point-${locale}`);
      await tap(page, 'c1');
      await press(page, 'practice-next');
      await press(page, 'practice-option-0');
      await press(page, 'practice-next');
      await press(page, 'practice-option-1');
      await press(page, 'practice-next');
      await page.waitForTimeout(300);
      await ordered(page, `${L} AC41 choice 7×7`, [
        'practice-prompt',
        'practice-board',
        'practice-option-0',
        'practice-feedback',
      ]);
      await fits(page, `${L} AC43 choice 7×7`, [...EXERCISE_CONTROLS, 'practice-option-1']);
      await shot(page, `21-u10-eyes-ex4-choice-7x7-${locale}`);
      await press(page, 'practice-option-0');
      await press(page, 'practice-next');
      await tap(page, 'd1');
      await press(page, 'practice-next');
      await page.waitForTimeout(300);
      await ordered(page, `${L} AC41 play-move`, [
        'practice-prompt',
        'practice-board',
        'practice-feedback',
      ]);
      await fits(page, `${L} AC43 play-move`, EXERCISE_CONTROLS);
      await shot(page, `21-u10-eyes-ex6-play-move-${locale}`);

      await openPractice(page, base, 'u11-two-eyes');
      await ordered(page, `${L} AC41 count`, [
        'practice-prompt',
        'practice-board',
        'practice-feedback',
      ]);
      await fits(page, `${L} AC43 count`, [
        ...EXERCISE_CONTROLS,
        'practice-chip-2',
        'practice-check',
      ]);
      await shot(page, `21-u11-two-eyes-ex1-count-${locale}`);

      // --- The sequence runner, four states on kill-straight (AC 29, 30) ---
      await openPractice(page, base, 'u11-vital');
      await tap(page, 'b1');
      await press(page, 'practice-next');
      await page.waitForTimeout(300);
      const seqControls = [...EXERCISE_CONTROLS, 'sequence-progress', 'practice-hint'];
      await ordered(page, `${L} AC41 sequence`, [
        'practice-prompt',
        'sequence-progress',
        'practice-board',
        'practice-feedback',
        'practice-hint',
      ]);
      const progressText = async () =>
        (await page.getByTestId('sequence-progress').innerText()).trim();
      check(
        `${L} AC14 progress`,
        (await progressText()).includes(
          s['sequence.progress'].replace('{{n}}', '1').replace('{{m}}', '2'),
        ),
      );
      await press(page, 'practice-hint');
      await page.waitForTimeout(400);
      check(
        `${L} AC27 hint ring on b1`,
        (await page.getByTestId('board-highlight-hint-b1').count()) === 1,
      );
      await fits(page, `${L} AC29 state A`, seqControls);
      await shot(page, `20-sequence-A-hint-${locale}`);

      await tap(page, 'a1');
      await page.waitForTimeout(800);
      check(
        `${L} AC18 refutation b1 played`,
        (await page.getByTestId('board-stone-b1').count()) === 1,
      );
      await fits(page, `${L} AC29 state C`, [...seqControls, 'practice-try-again']);
      const hintBox = await page.getByTestId('practice-hint').boundingBox();
      const againBox = await page.getByTestId('practice-try-again').boundingBox();
      check(
        `${L} AC30 Hint and Try again side by side, ≥ 44 px`,
        Math.abs(hintBox.y - againBox.y) < 1 &&
          hintBox.height >= 44 &&
          againBox.height >= 44 &&
          Math.round(againBox.x - (hintBox.x + hintBox.width)) === 12,
        `gap ${(againBox.x - (hintBox.x + hintBox.width)).toFixed(1)}`,
      );
      await shot(page, `20-sequence-C-refuted-${locale}`);
      await press(page, 'practice-try-again');

      await tap(page, 'b1');
      await page.waitForTimeout(80);
      check(
        `${L} AC15 replying status`,
        (await page.getByTestId('sequence-status').innerText()).trim() === s['sequence.replies.B'],
      );
      await shot(page, `20-sequence-B-replying-${locale}`);
      await page.waitForTimeout(700);
      await tap(page, 'c1');
      await page.waitForTimeout(500);
      check(
        `${L} AC16 captured 6`,
        (await page.getByTestId('practice-feedback').innerText()).includes('6'),
      );
      await fits(page, `${L} AC29 state D`, [
        ...EXERCISE_CONTROLS,
        'sequence-progress',
        'practice-next',
      ]);
      await shot(page, `20-sequence-D-solved-${locale}`);

      // --- Capture Go: the goal card on top (AC 42, 43) ---
      for (const [id, name] of [
        ['u06-capture-go', '5x5'],
        ['u06-checkpoint', '7x7'],
      ]) {
        await openPractice(page, base, id);
        await ordered(page, `${L} AC42 ${id}`, [
          'game-goal',
          'game-score-you',
          'practice-board',
          'practice-feedback',
        ]);
        await fits(page, `${L} AC43 capture go ${name}`, [
          'practice-close',
          'game-goal',
          'practice-board',
          'game-restart',
        ]);
        await shot(page, `21-capture-go-${name}-${locale}`);
      }
      await context.close();
    }

    // --- Lighter bamboo, 9×9 (AC 50): after, and recoloured to the old tokens ---
    const { context, page } = await newPage(browser, 'en');
    await page.goto(`${base}/dev/board`);
    await page.getByTestId('board-touch').waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
    for (const v of ['c3', 'd4', 'e5', 'f4', 'e4', 'g3', 'c7', 'g7', 'd6', 'f6']) {
      await tap(page, v, 9, 'board-touch');
    }
    await page.waitForTimeout(400);
    const board = await page.getByTestId('board-touch').boundingBox();
    const clip = { x: board.x, y: board.y, width: board.width, height: board.height };
    await page.screenshot({ path: path.join(SHOTS, '22-board-9x9-after.png'), clip });
    await page.evaluate((map) => {
      for (const el of document.querySelectorAll('svg *')) {
        for (const attr of ['fill', 'stroke']) {
          const value = (el.getAttribute(attr) ?? '').toLowerCase();
          if (map[value]) el.setAttribute(attr, map[value]);
        }
      }
    }, OLD_COLOURS);
    await page.screenshot({ path: path.join(SHOTS, '22-board-9x9-before.png'), clip });
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  check('zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll M5 life-and-death web checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
