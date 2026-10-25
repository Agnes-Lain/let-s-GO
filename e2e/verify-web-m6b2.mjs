#!/usr/bin/env node
// QA web check for docs/specs/M6b-13x13-bot-tuning.md (360x740): a short 13×13 game, the count
// screen with dead-stone marks, the result screen with the Review 复盘 button and the review view.
//   PLAYWRIGHT_PATH=... CHROMIUM_PATH=... node e2e/verify-web-m6b2.mjs [baseUrl]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'docs', 'screenshots', 'M6b');
const COLUMNS = 'abcdefghjklmn';
const base = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:8099';
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_PATH ?? 'playwright-core',
);
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
};
const wait = (page, ms) => page.waitForTimeout(ms);
const press = async (page, id) => {
  await page.getByTestId(id).last().click();
  await wait(page, 400);
};
const progress = JSON.stringify({
  v: 1,
  lessons: {},
  bots: { 1: { games: 1, wins: 1, lossStreak: 0, handicap: 0 } },
  flags: { onboardingSeen: true },
});

async function at(page, vertex) {
  const box = await page.getByTestId('game9-board').last().boundingBox();
  const cell = box.width / 14.4;
  return {
    x: box.x + 1.2 * cell + COLUMNS.indexOf(vertex[0]) * cell,
    y: box.y + 1.2 * cell + (13 - Number(vertex.slice(1))) * cell,
  };
}
async function tap(page, vertex) {
  const p = await at(page, vertex);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
  await wait(page, 1500);
}
async function layout(page, where) {
  const m = await page.evaluate(() => ({
    w: document.scrollingElement.scrollWidth,
    h: document.scrollingElement.scrollHeight,
    small: [...document.querySelectorAll('[role=button], button')]
      .map((el) => [el, el.getBoundingClientRect()])
      .filter(([, r]) => r.width > 0 && (r.height < 43.5 || r.width < 43.5 || r.right > 360.5))
      .map(
        ([el, r]) =>
          `${el.getAttribute('data-testid')} ${Math.round(r.width)}x${Math.round(r.height)}`,
      ),
    cut: [...document.querySelectorAll('[data-testid]')]
      .filter(
        (el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible',
      )
      .map((el) => el.getAttribute('data-testid')),
  }));
  check(`${where}: no horizontal scroll`, m.w <= 360, `${m.w}x${m.h}`);
  check(
    `${where}: tap targets >= 44 and inside`,
    m.small.length === 0,
    m.small.slice(0, 4).join(' | '),
  );
  check(`${where}: no clipped text`, m.cut.length === 0, m.cut.slice(0, 4).join(' | '));
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
fs.mkdirSync(SHOTS, { recursive: true });
for (const locale of ['zh-CN', 'en', 'fr']) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    locale,
  });
  await context.addInitScript((v) => {
    if (!window.localStorage.getItem('progress')) window.localStorage.setItem('progress', v);
    Math.random = () => 0.25;
  }, progress);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/game/play?level=1&handicap=0&size=13`);
  await page.getByTestId('game9-board').last().waitFor();
  for (const v of ['k10', 'c3', 'l11', 'c10', 'k3', 'd11']) await tap(page, v);
  const moves = await page.getByTestId('game9-move').last().innerText();
  console.log(locale, 'moves:', moves);
  await press(page, 'game9-count-now');
  await press(page, 'game9-count-confirm');
  await wait(page, 1500);
  await page.screenshot({ path: path.join(SHOTS, `21-count-13-${locale}.png`) });
  await layout(page, `${locale} count`);
  // mark one stone as dead, then finish
  const stone = page.getByTestId('board-stone-k10');
  if (await stone.count()) {
    const p = await at(page, 'k10');
    await page.mouse.click(p.x, p.y);
    await wait(page, 400);
  }
  await page.screenshot({ path: path.join(SHOTS, `22-count-marked-13-${locale}.png`) });
  await layout(page, `${locale} count marked`);
  await press(page, 'game9-mark-done');
  await wait(page, 600);
  await page.screenshot({ path: path.join(SHOTS, `22b-count-warning-13-${locale}.png`) });
  await press(page, 'game9-mark-done');
  await page.screenshot({ path: path.join(SHOTS, `23a-count-score-13-${locale}.png`) });
  await layout(page, `${locale} score`);
  await press(page, 'game9-count-done');
  await wait(page, 600);
  await page.screenshot({ path: path.join(SHOTS, `23-result-13-${locale}.png`) });
  await layout(page, `${locale} result`);
  const hasReview = (await page.getByTestId('game9-review').count()) > 0;
  check(`${locale}: Review button shown`, hasReview);
  if (hasReview) {
    await press(page, 'game9-review');
    await wait(page, 2500);
    await page.screenshot({ path: path.join(SHOTS, `24-review-13-${locale}.png`) });
    await layout(page, `${locale} review`);
    const box = await page.getByTestId('review-board').last().boundingBox();
    check(`${locale}: review board 328 wide`, Math.round(box.width) === 328, `${box.width}`);
    for (let i = 0; i < 3; i++) await press(page, 'review-prev');
    await page.screenshot({ path: path.join(SHOTS, `25-review-13-prev-${locale}.png`) });
    await layout(page, `${locale} review stepped`);
  }
  check(`${locale}: no page errors`, errors.length === 0, errors[0] ?? '');
  await context.close();
}
await browser.close();
console.log(failures.length === 0 ? 'ALL PASS' : `${failures.length} FAILED`);
process.exit(failures.length === 0 ? 0 : 1);
