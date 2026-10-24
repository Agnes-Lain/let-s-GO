#!/usr/bin/env node
// QA web check for docs/specs/M6-beginner-friendly.md §10 (360x740): picker handicap row, handicap
// game, atari rings, take-back, result suggestion, AC 43 console warning. Runs against a URL
// (default http://localhost:8099, a DEV `npx expo start --web` server so React warnings show).
//   CHROMIUM_PATH=... PLAYWRIGHT_PATH=... node e2e/verify-web-m6-beginner.mjs [baseUrl] [--explore "level h e5 d4 ..."]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'docs', 'screenshots', 'M6');
const VIEWPORT = { width: 360, height: 740 };
const COLUMNS = 'abcdefghj';
const LOCALES = ['zh-CN', 'en', 'fr'];
const base = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:8099';
const exploreAt = process.argv.indexOf('--explore');

const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_PATH ?? 'playwright-core',
);
const failures = [];
const logs = [];
const warnings = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
};
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const wait = (page, ms) => page.waitForTimeout(ms);
const has = async (page, id) => (await page.getByTestId(id).count()) > 0;
const press = async (page, id) => {
  await page.getByTestId(id).last().click();
  await wait(page, 300);
};

const LESSONS = [
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
function progress(extra = {}) {
  const e = {
    stars: 1,
    plays: 1,
    bestClean: 4,
    bestSolved: 4,
    total: 7,
    lastPlayedAt: '2026-10-21T00:00:00.000Z',
  };
  return JSON.stringify({
    v: 1,
    lessons: Object.fromEntries(LESSONS.map((id) => [id, e])),
    ...extra,
  });
}

async function newPage(browser, locale, extra = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale });
  await context.addInitScript((value) => {
    if (!window.localStorage.getItem('progress')) window.localStorage.setItem('progress', value);
    Math.random = () => 0.25; // a fixed game seed: the bot's replies repeat
    // The dev server's red toast for console.error covers the buttons; the text is logged below.
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = '#error-toast{display:none!important}';
      document.head.appendChild(st);
    });
  }, progress(extra));
  const page = await context.newPage();
  page.on('console', async (m) => {
    let text = m.text();
    // React prints "Received `%s` for a non-boolean attribute `%s`": resolve the arguments.
    if (/non-boolean attribute/.test(text)) {
      const vals = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '?')));
      text = `${vals.slice(0, 3).join(' | ').replace(/\n/g, ' ').slice(0, 200)} [attribute ${vals.slice(-1)}] ${vals[1] ?? ''}`;
      warnings.push(`[${locale}] ${text}`);
    }
    logs.push(`[${locale}] ${m.type()}: ${text}`);
  });
  page.on('pageerror', (e) => logs.push(`[${locale}] pageerror ${e.message}`));
  return { context, page };
}

async function tap(page, vertex) {
  const box = await page.getByTestId('game9-board').last().boundingBox();
  const cell = box.width / 10;
  await page.mouse.move(
    box.x + (1 + COLUMNS.indexOf(vertex[0])) * cell,
    box.y + (1 + 9 - Number(vertex.slice(1))) * cell,
  );
  await page.mouse.down();
  await page.mouse.up();
  await wait(page, 150);
}
const move = async (page, v) => {
  await tap(page, v);
  await wait(page, 1300);
};

async function layout(page, where) {
  const { width, height } = await page.evaluate(() => ({
    width: document.scrollingElement.scrollWidth,
    height: document.scrollingElement.scrollHeight,
  }));
  check(`${where}: no page scroll`, width <= 360 && height <= 740, `${width}x${height}`);
  if (await has(page, 'game9-board')) {
    const b = await page.getByTestId('game9-board').last().boundingBox();
    check(
      `${where}: board 328 inside 360`,
      Math.round(b.width) === 328 && b.x >= 0 && b.x + b.width <= 360,
      `${b.width}`,
    );
  }
  const bad = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(
      '[role=button], button, [role=radio], [data-testid^=game9-chip]',
    )) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 43.5 || r.width < 43.5)
        out.push(
          `small ${el.getAttribute('data-testid')} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
    }
    for (const el of document.querySelectorAll('div,span')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'inline') continue;
      if (
        (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) &&
        cs.overflow !== 'visible'
      )
        out.push(
          `clipped "${el.textContent.trim().slice(0, 40)}" ${el.scrollWidth}/${el.clientWidth} ${el.scrollHeight}/${el.clientHeight}`,
        );
      const r = el.getBoundingClientRect();
      if (r.right > 360.5 || r.left < -0.5)
        out.push(`outside "${el.textContent.trim().slice(0, 30)}"`);
    }
    return out;
  });
  check(
    `${where}: tap targets >= 44, nothing clipped`,
    bad.length === 0,
    bad.slice(0, 4).join(' | '),
  );
}

const feedback = async (page) =>
  (await has(page, 'practice-feedback'))
    ? await page.getByTestId('practice-feedback').last().innerText()
    : '';
async function rings(page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '[data-testid^="board-highlight-"], [data-testid^="board-marker-diamond"]',
      ),
    ].map((e) => e.getAttribute('data-testid')),
  );
}

async function ascii(page) {
  const st = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('[data-testid^="board-stone-"]')].map((e) => [
        e.getAttribute('data-testid').slice(12),
        (
          e.getAttribute('fill') ||
          e.querySelector('[fill]')?.getAttribute('fill') ||
          ''
        ).toLowerCase(),
      ]),
    ),
  );
  const rows = [];
  for (let r = 9; r >= 1; r--)
    rows.push(
      `${r} ` +
        [...COLUMNS]
          .map((c) => {
            const f = st[c + r];
            return f === undefined ? '.' : /#2|#1|#0|black/.test(f) ? 'X' : 'O';
          })
          .join(' '),
    );
  return rows.join('\n');
}
async function openPicker(page) {
  await page.goto(`${base}/game`);
  await page.getByTestId('game9-level-1').waitFor({ timeout: 120000 });
  await wait(page, 400);
}
async function openGame(page, level, handicap) {
  await page.goto(`${base}/game/play?level=${level}&handicap=${handicap}`);
  await page.getByTestId('game9-board').waitFor({ timeout: 60000 });
  await wait(page, 500);
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  if (exploreAt > 0) {
    // --explore "level handicap v1 v2 ..." prints the rings after every learner move
    const [level, handicap, ...moves] = process.argv[exploreAt + 1].split(' ');
    const { page } = await newPage(browser, 'en');
    await openGame(page, level, handicap);
    await wait(page, 1500);
    console.log('start', await rings(page), await feedback(page));
    for (const v of moves) {
      await move(page, v);
      console.log(v, await rings(page), JSON.stringify(await feedback(page)));
      console.log(await ascii(page));
    }
    await browser.close();
    return;
  }
  const scenario = JSON.parse(fs.readFileSync(path.join(ROOT, 'e2e', 'm6-scenarios.json'), 'utf8'));
  for (const locale of LOCALES) await scenarioRun(browser, locale, scenario);
  fs.writeFileSync(
    path.join(SHOTS, '29-no-console-warning.txt'),
    `Dev web build (expo start --web), 360x740, locales ${LOCALES.join(', ')}.\nPages: home, picker, lesson u01 (+leave sheet), game (+pass/resign/count sheets), result.\n` +
      `Matches for "non-boolean attribute" / "Received \`false\`": ${warnings.length}\n${warnings.join('\n')}\n\n--- all console messages ---\n${logs.join('\n')}\n`,
  );
  const acc = warnings.filter((l) => /accessible/.test(l));
  check('AC 43: no "non-boolean attribute accessible" warning', acc.length === 0, acc[0] ?? '');
  // QA bug 1: `collapsable` (Animated) must not reach the DOM either; no such warning at all.
  check('no "non-boolean attribute" warning of any kind', warnings.length === 0, warnings[0] ?? '');
  await browser.close();
  console.log(failures.length ? `\nFAILED: ${failures.length}` : '\nAll checks passed.');
  process.exit(failures.length ? 1 : 0);
}

async function scenarioRun(browser, locale, sc) {
  const L = `[${locale}]`;
  const extra = {
    bots: {
      1: { games: 1, wins: 1, lossStreak: 0, handicap: 3 },
      2: { games: 0, wins: 0, lossStreak: 0 },
    },
  };
  let { context, page } = await newPage(browser, locale, extra);
  // Home + a lesson + leave sheet (AC 43)
  await page.goto(`${base}/learn`);
  await page.getByTestId('home-game9').waitFor({ timeout: 120000 });
  await wait(page, 500);
  // 20 picker (Easy selected, stored suggestion 3)
  await openPicker(page);
  await layout(page, `${L} picker`);
  check(
    `${L} picker: 5 chips`,
    (await page.locator('[data-testid^="game9-handicap-"]').count()) >= 5,
  );
  await shot(page, `20-picker-handicap-${locale}`);
  await press(page, 'game9-handicap-5');
  await layout(page, `${L} picker 5`);
  await shot(page, `21-picker-handicap-5-${locale}`);
  await press(page, 'game9-start');
  await page.getByTestId('game9-board').waitFor({ timeout: 30000 });
  await wait(page, 1600);
  // 22 handicap game, White's first move shown
  await layout(page, `${L} handicap game`);
  check(
    `${L} handicap game: Take back disabled before the first learner move`,
    await page.getByTestId('game9-takeback').last().isDisabled(),
  );
  await shot(page, `22-game-handicap-white-first-${locale}`);
  // sheets for AC 43 (pass, resign, leave) in the game
  await press(page, 'game9-close');
  check(`${L} leave sheet opens`, await has(page, 'game9-leave-sheet'));
  await wait(page, 300);
  await shot(page, `30-game-leave-sheet-${locale}`);
  await press(page, 'game9-leave-stay');
  await press(page, 'game9-resign');
  check(`${L} resign sheet opens`, await has(page, 'game9-resign-sheet'));
  await press(page, 'game9-resign-keep');
  await context.close();
  // a lesson with its leave sheet (AC 43)
  ({ context, page } = await newPage(browser, locale));
  await page.goto(`${base}/practice/u01-board`);
  await page.getByTestId('practice-close').waitFor({ timeout: 60000 });
  await wait(page, 600);
  await press(page, 'practice-close');
  await wait(page, 400);
  check(`${L} lesson leave sheet opens`, await has(page, 'leave-sheet'));
  await context.close();

  // 23 own atari, 24 white atari, 25 both, 26 take-back, 27 limit, 28 result
  for (const [name, def] of Object.entries(sc)) {
    ({ context, page } = await newPage(browser, locale, def.extra ?? {}));
    await openGame(page, def.level, def.handicap);
    await wait(page, 1500);
    for (const v of def.moves) {
      if (v === 'TB') {
        await press(page, 'game9-takeback');
        await wait(page, 400);
      } else await move(page, v);
    }
    const r = await rings(page);
    const fb = await feedback(page);
    console.log(`${L} ${name}: rings ${r.join(',')} | ${JSON.stringify(fb)}`);
    for (const re of def.expectRings ?? [])
      check(
        `${L} ${name}: ring/diamond ${re}`,
        r.some((x) => x.includes(re)),
        r.join(','),
      );
    if (def.expectText) check(`${L} ${name}: feedback has text`, fb.length > 10, fb);
    if (name.startsWith('26'))
      check(`${L} ${name}: note says taken back`, /Taken back|已悔棋|Coup repris/.test(fb), fb);
    if (name.startsWith('27'))
      console.log(
        `${L} ${name}: label ${JSON.stringify(await page.getByTestId('game9-takeback').last().innerText())}`,
      );
    if (def.disabledTakeback)
      check(
        `${L} ${name}: Take back disabled`,
        await page.getByTestId('game9-takeback').last().isDisabled(),
      );
    if (def.resign) {
      await press(page, 'game9-resign');
      await press(page, 'game9-resign-confirm');
      await wait(page, 600);
    }
    await layout(page, `${L} ${name}`);
    const lines = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="practice-feedback"]');
      if (!el) return 0;
      return Math.round(el.getBoundingClientRect().height);
    });
    console.log(`${L} ${name}: feedback card height ${lines}`);
    await shot(page, `${def.shot}-${locale}`);
    await context.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
