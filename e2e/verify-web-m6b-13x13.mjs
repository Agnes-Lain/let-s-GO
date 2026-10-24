#!/usr/bin/env node
// Web check for docs/specs/M6b-13x13-game.md (360x740): the Learn page 13×13 card (locked /
// open, §13), the 13×13 picker, the 13×13 game screen layout, the touch preview with crosshair, Confirm each move
// and a few moves against Easy. Runs against a URL (default http://localhost:8099, a DEV
// `npx expo start --web --port 8099` server).
//   CHROMIUM_PATH=... PLAYWRIGHT_PATH=... node e2e/verify-web-m6b-13x13.mjs [baseUrl]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'docs', 'screenshots', 'M6b');
const VIEWPORT = { width: 360, height: 740 };
const COLUMNS = 'abcdefghjklmn';
const base = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:8099';

const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_PATH ?? 'playwright-core',
);
const failures = [];
const errors = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
};
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const wait = (page, ms) => page.waitForTimeout(ms);
const press = async (page, id) => {
  await page.getByTestId(id).last().click();
  await wait(page, 300);
};

/** Saved progress: onboarding seen, and (when `won9`) one 9×9 win so 13×13 is open. */
function progress(won9) {
  return JSON.stringify({
    v: 1,
    lessons: {},
    ...(won9 ? { bots: { 1: { games: 1, wins: 1, lossStreak: 0, handicap: 0 } } } : {}),
    flags: { onboardingSeen: true },
  });
}

async function newPage(browser, locale, won9) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale });
  await context.addInitScript((value) => {
    if (!window.localStorage.getItem('progress')) window.localStorage.setItem('progress', value);
    Math.random = () => 0.25;
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = '#error-toast{display:none!important}';
      document.head.appendChild(st);
    });
  }, progress(won9));
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[${locale}] pageerror ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${locale}] ${m.text().slice(0, 200)}`);
  });
  return { context, page };
}

/** The pixel of a 13×13 vertex on the board (coordinates on: margin 1.2 cells). */
async function at(page, vertex) {
  const box = await page.getByTestId('game9-board').last().boundingBox();
  const cell = box.width / 14.4;
  const origin = 1.2 * cell;
  return {
    x: box.x + origin + COLUMNS.indexOf(vertex[0]) * cell,
    y: box.y + origin + (13 - Number(vertex.slice(1))) * cell,
  };
}

async function tap(page, vertex) {
  const p = await at(page, vertex);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
  await wait(page, 150);
}

async function layout(page, where) {
  const { width, height } = await page.evaluate(() => ({
    width: document.scrollingElement.scrollWidth,
    height: document.scrollingElement.scrollHeight,
  }));
  check(`${where}: no page scroll`, width <= 360 && height <= 740, `${width}x${height}`);
  const bad = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[role=button], button, [role=radio]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 43.5 || r.width < 43.5)
        out.push(
          `small ${el.getAttribute('data-testid')} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
      if (r.right > 360.5 || r.left < -0.5) out.push(`outside ${el.getAttribute('data-testid')}`);
    }
    return out;
  });
  check(`${where}: tap targets >= 44, inside 360`, bad.length === 0, bad.slice(0, 4).join(' | '));
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

  // Learn page (§13, PO 2026-10-25): the 13×13 card below 9×9, locked until a 9×9 win.
  for (const locale of ['zh-CN', 'en', 'fr']) {
    for (const won9 of [false, true]) {
      const tag = won9 ? 'unlocked' : 'locked';
      const { context, page } = await newPage(browser, locale, won9);
      await page.goto(`${base}/learn`);
      const card = page.getByTestId('home-game13').last();
      await card.waitFor();
      await card.scrollIntoViewIfNeeded();
      await wait(page, 300);
      const b9 = await page.getByTestId('home-game9').last().boundingBox();
      const b13 = await card.boundingBox();
      check(`${locale} learn ${tag}: 13×13 card below 9×9`, b13.y > b9.y, `${b9.y} < ${b13.y}`);
      check(`${locale} learn ${tag}: card height >= 44`, b13.height >= 44, `${b13.height}`);
      const lock = (await page.getByTestId('home-game13-lock').count()) > 0;
      check(`${locale} learn ${tag}: lock icon ${won9 ? 'hidden' : 'shown'}`, lock === !won9);
      await shot(page, `00-learn-13-${tag}-${locale}`);
      await card.click({ force: true });
      await wait(page, 600);
      const url = page.url();
      check(
        `${locale} learn ${tag}: tap ${won9 ? 'opens /game?size=13' : 'does nothing'}`,
        won9 ? /\/game\?size=13/.test(url) : /\/learn/.test(url),
        url,
      );
      await context.close();
    }
  }

  for (const locale of ['zh-CN', 'en', 'fr']) {
    const { context, page } = await newPage(browser, locale, true);
    await page.goto(`${base}/game?size=13`);
    await page.getByTestId('game-size-time').waitFor();
    check(
      `${locale} picker: no size control`,
      (await page.getByTestId('game-size-13').count()) === 0,
    );
    await layout(page, `${locale} picker 13×13`);
    await shot(page, `02-picker-13-${locale}`);
    await page.getByTestId('game-confirm-switch').scrollIntoViewIfNeeded();
    await shot(page, `03-picker-13-bottom-${locale}`);
    await press(page, 'game9-start');
    await page.getByTestId('game9-board').last().waitFor();
    await wait(page, 1800); // handicap: White moves first
    const box = await page.getByTestId('game9-board').last().boundingBox();
    check(`${locale} game: board 328 wide`, Math.round(box.width) === 328, `${box.width}`);
    await layout(page, `${locale} game 13×13`);
    await shot(page, `04-game-13-${locale}`);

    // Touch-down preview with crosshair and tag, then lift.
    const p = await at(page, 'k3');
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await wait(page, 150);
    check(`${locale} preview: crosshair`, (await page.getByTestId('board-crosshair').count()) > 0);
    await shot(page, `05-preview-13-${locale}`);
    await page.mouse.up();
    await wait(page, 300);
    await shot(page, `06-thinking-13-${locale}`);
    await wait(page, 1500);
    for (const v of ['c10', 'c3', 'l11']) {
      await tap(page, v);
      await wait(page, 1600);
    }
    await shot(page, `07-moves-13-${locale}`);
    await context.close();
  }

  // Confirm each move.
  {
    const { context, page } = await newPage(browser, 'en', true);
    await page.goto(`${base}/game/play?level=1&handicap=0&size=13&confirm=1`);
    await page.getByTestId('game9-board').last().waitFor();
    await tap(page, 'g7');
    check('confirm: ghost after lift', (await page.getByTestId('board-ghost').count()) > 0);
    await shot(page, '08-confirm-preview-en');
    await press(page, 'game-confirm-play');
    check('confirm: stone placed', (await page.getByTestId('board-stone-g7').count()) > 0);
    await layout(page, 'confirm game');
    await context.close();
  }

  await browser.close();
  if (errors.length > 0) console.log(`console errors:\n  ${errors.slice(0, 10).join('\n  ')}`);
  console.log(failures.length === 0 ? 'ALL PASS' : `${failures.length} FAILED`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
