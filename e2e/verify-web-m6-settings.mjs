#!/usr/bin/env node
// QA web check for docs/specs/M6-settings-onboarding-a11y.md (360x740): the W acceptance criteria
// (AC 8, 15, 23, 33, 45, 49, 54, 65) and the screenshots of spec §8 (60-82).
// Runs against a URL (default http://localhost:8099, a DEV `npx expo start --web` server so React
// warnings show).
//   CHROMIUM_PATH=... PLAYWRIGHT_PATH=... node e2e/verify-web-m6-settings.mjs [baseUrl]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'docs', 'screenshots', 'M6');
const VIEWPORT = { width: 360, height: 740 };
const LOCALES = ['zh-CN', 'en', 'fr'];
const BROWSER_LOCALE = { 'zh-CN': 'zh-CN', en: 'en-US', fr: 'fr-FR' };
const base = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:8099';

const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_PATH ?? 'playwright-core',
);
const texts = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'i18n', `${l}.json`), 'utf8')),
  ]),
);
const failures = [];
const consoleLog = [];
const tapReport = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
};
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const wait = (page, ms) => page.waitForTimeout(ms);
const tid = (page, id) => page.getByTestId(id).first();
const has = async (page, id) => (await page.getByTestId(id).count()) > 0;
const click = async (page, id) => {
  await tid(page, id).click();
  await wait(page, 300);
};

// ---- seeds -------------------------------------------------------------------------------------
const ENTRY = {
  stars: 1,
  plays: 1,
  bestClean: 4,
  bestSolved: 4,
  total: 7,
  lastPlayedAt: '2026-10-24T00:00:00.000Z',
};
const MODULE_1 = [
  'u01-board',
  'u02-liberties',
  'u03-connection',
  'u04-capture',
  'u05-atari',
  'u05-review',
];
const MODULE_2 = [
  'u06-capture-go',
  'u06-checkpoint',
  'u07-forbidden',
  'u08-ko',
  'u09-ladder',
  'u09-review',
];
const MODULE_3 = [
  'u10-eyes',
  'u11-two-eyes',
  'u11-vital',
  'u11-review',
  'u12-territory',
  'u13-counting',
  'u14-review',
  'u14-end',
];
const progress = (ids = [], flags = { onboardingSeen: true }) =>
  JSON.stringify({ v: 1, lessons: Object.fromEntries(ids.map((id) => [id, ENTRY])), flags });
const SEEDS = {
  fresh: null,
  seen: progress(),
  module1Done: progress(MODULE_1),
  module2Done: progress([...MODULE_1, ...MODULE_2]),
  all: progress([...MODULE_1, ...MODULE_2, ...MODULE_3]),
};

async function newPage(browser, locale, seed = 'seen', settings = null) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    locale: BROWSER_LOCALE[locale],
  });
  await context.addInitScript(
    ([progressValue, settingsValue]) => {
      // Seed once (a reload keeps what the app saved).
      if (window.sessionStorage.getItem('qa-seeded')) return;
      window.sessionStorage.setItem('qa-seeded', '1');
      if (progressValue) window.localStorage.setItem('progress', progressValue);
      if (settingsValue) window.localStorage.setItem('settings', settingsValue);
      // The dev server's red toast for console.error covers the buttons; the text is logged below.
      document.addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style');
        st.textContent = '#error-toast{display:none!important}';
        document.head.appendChild(st);
      });
    },
    [SEEDS[seed], settings],
  );
  const page = await context.newPage();
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type()))
      consoleLog.push(`[${locale}] ${m.type()}: ${m.text().replace(/\n/g, ' ').slice(0, 300)}`);
  });
  page.on('pageerror', (e) => consoleLog.push(`[${locale}] pageerror ${e.message}`));
  return { context, page };
}

// ---- generic checks ----------------------------------------------------------------------------
/** No page scroll sideways, pressables >= 44 (rows >= minRow), text >= 12 px, nothing clipped. */
async function audit(page, where, { minRow = 44, scrollY = true } = {}) {
  const r = await page.evaluate((minRowHeight) => {
    const out = { small: [], text: [], clipped: [], pressables: [] };
    const sel = '[role=button], button, [role=switch], [role=radio], [role=link], a[href]';
    for (const el of document.querySelectorAll(sel)) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const id =
        el.getAttribute('data-testid') ||
        el.getAttribute('aria-label') ||
        el.textContent.trim().slice(0, 24);
      out.pressables.push(`${id}\t${Math.round(b.width)}x${Math.round(b.height)}`);
      if (b.height < 43.5 || b.width < 43.5)
        out.small.push(`${id} ${Math.round(b.width)}x${Math.round(b.height)}`);
      if (
        /^settings-(sound|motion|atari)$/.test(el.getAttribute('data-testid') || '') &&
        b.height < minRowHeight
      )
        out.small.push(`${id} row ${Math.round(b.height)} < ${minRowHeight}`);
    }
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg')) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own.length) continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const cs = getComputedStyle(el);
      if (parseFloat(cs.fontSize) < 12)
        out.text.push(`"${own[0].textContent.trim().slice(0, 24)}" ${cs.fontSize}`);
      if (
        cs.display !== 'inline' &&
        cs.overflow !== 'visible' &&
        (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) &&
        !/auto|scroll/.test(cs.overflowY + cs.overflowX)
      )
        out.clipped.push(
          `"${own[0].textContent.trim().slice(0, 30)}" ${el.scrollWidth}/${el.clientWidth} ${el.scrollHeight}/${el.clientHeight}`,
        );
      if (b.right > 360.5 || b.left < -0.5)
        out.clipped.push(`outside "${own[0].textContent.trim().slice(0, 30)}"`);
    }
    out.scrollWidth = document.scrollingElement.scrollWidth;
    out.scrollHeight = document.scrollingElement.scrollHeight;
    return out;
  }, minRow);
  for (const line of r.pressables) tapReport.push(`${where}\t${line}`);
  check(`${where}: no horizontal scroll`, r.scrollWidth <= 360, `${r.scrollWidth}`);
  if (!scrollY)
    check(`${where}: fits 740 without page scroll`, r.scrollHeight <= 740, `${r.scrollHeight}`);
  check(`${where}: tap targets >= 44`, r.small.length === 0, r.small.slice(0, 4).join(' | '));
  check(`${where}: text >= 12 px`, r.text.length === 0, r.text.slice(0, 4).join(' | '));
  check(
    `${where}: nothing clipped / outside`,
    r.clipped.length === 0,
    r.clipped.slice(0, 4).join(' | '),
  );
  return r;
}

// ---- 1. Settings (AC 23, 12-ish, 45, 8) ---------------------------------------------------------
async function settingsChecks(browser) {
  for (const locale of LOCALES) {
    const L = texts[locale];
    const { context, page } = await newPage(browser, locale);
    await page.goto(`${base}/settings`);
    await tid(page, 'settings-scroll').waitFor({ timeout: 60000 });
    await wait(page, 500);
    check(
      `[${locale}] settings title`,
      (await page.locator('body').innerText()).includes(L['settings.title']),
    );
    await audit(page, `[${locale}] settings top`, { minRow: 52 });
    await shot(page, `60-settings-top-${locale}`);
    // Rows >= 52 (AC 23): the switch rows, the intro row and the reset row.
    for (const id of [
      'settings-sound',
      'settings-motion',
      'settings-atari',
      'settings-intro',
      'settings-reset',
    ]) {
      const b = await tid(page, id).boundingBox();
      check(`[${locale}] ${id} row >= 52 px`, b.height >= 51.5, `${b.height}`);
    }
    // Back button >= 44 (first button on the page is the TopBar back).
    const back = await page.locator('[role=button]').first().boundingBox();
    check(
      `[${locale}] back button >= 44`,
      back.width >= 43.5 && back.height >= 43.5,
      `${back.width}x${back.height}`,
    );
    // Long French descriptions wrap in <= 3 lines.
    for (const id of ['settings-sound', 'settings-motion', 'settings-atari']) {
      const n = await tid(page, id).evaluate((el) => {
        const t = [...el.querySelectorAll('div')].filter(
          (d) => d.children.length === 0 && d.textContent.trim(),
        );
        return Math.max(
          ...t.map((d) =>
            Math.round(
              d.getBoundingClientRect().height / (parseFloat(getComputedStyle(d).lineHeight) || 18),
            ),
          ),
        );
      });
      check(`[${locale}] ${id}: text <= 3 lines`, n <= 3, `${n}`);
    }
    // Scrolls vertically inside the page.
    const scrollable = await tid(page, 'settings-scroll').evaluate(
      (el) => el.scrollHeight > el.clientHeight,
    );
    check(`[${locale}] settings scrolls vertically`, scrollable);
    await tid(page, 'settings-scroll').evaluate((el) => (el.scrollTop = el.scrollHeight));
    await wait(page, 300);
    await shot(page, `61-settings-bottom-${locale}`);
    await audit(page, `[${locale}] settings bottom`, { minRow: 52 });

    // Reset sheet (AC 20-21).
    await click(page, 'settings-reset');
    check(`[${locale}] reset sheet opens`, await has(page, 'settings-reset-keep'));
    await shot(page, `62-settings-reset-sheet-${locale}`);
    await audit(page, `[${locale}] reset sheet`);
    await click(page, 'settings-reset-confirm');
    check(`[${locale}] reset done line shows`, await has(page, 'settings-reset-done'));
    await tid(page, 'settings-scroll').evaluate((el) => (el.scrollTop = el.scrollHeight));
    await wait(page, 200);
    await shot(page, `63-settings-after-reset-${locale}`);
    await context.close();
  }

  // AC 15 + 64: Reduce motion on (en), and the demo stone appears in the very next frame.
  for (const reduce of [true, false]) {
    const { context, page } = await newPage(browser, 'en', 'seen');
    await page.goto(`${base}/settings`);
    await tid(page, 'settings-motion').waitFor({ timeout: 60000 });
    if (reduce) {
      await click(page, 'settings-motion');
      await shot(page, '64-settings-reduce-motion-on-en');
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('settings') ?? '{}'));
      check('[en] reduceMotion saved', saved.reduceMotion === true);
    }
    await page.goto(`${base}/onboarding?replay=1`);
    await tid(page, 'onboarding-next').waitFor({ timeout: 60000 });
    await click(page, 'onboarding-next');
    await tid(page, 'onboarding-demo-board').waitFor();
    // Record the stone's opacity when it first enters the DOM.
    await page.evaluate(() => {
      window.__stone = null;
      new MutationObserver(() => {
        const el = document.querySelector('[data-testid="board-stone-c3"]');
        if (el && !window.__stone) {
          const walk = (n) => {
            let o = 1;
            for (let e = n; e && e !== document.body; e = e.parentElement)
              o *= parseFloat(getComputedStyle(e).opacity);
            return o;
          };
          window.__stone = { opacity: walk(el), t: performance.now() };
        }
      }).observe(document.body, { childList: true, subtree: true, attributes: true });
    });
    await demoTap(page, 'c3', false);
    await wait(page, 30);
    const first = await page.evaluate(() => window.__stone);
    await wait(page, 600);
    check(
      `[en] demo stone first frame: reduce motion ${reduce ? 'on -> opacity 1' : 'off (control)'}`,
      first !== null && (reduce ? first.opacity >= 0.99 : true),
      JSON.stringify(first),
    );
    if (!reduce)
      console.log(`INFO  control (motion allowed) first-frame opacity: ${first?.opacity}`);
    await context.close();
  }

  // AC 8 / 4: the language survives a reload, from the first painted frame.
  for (const choice of LOCALES) {
    const { context, page } = await newPage(browser, 'en', 'seen');
    await page.goto(`${base}/settings`);
    await tid(page, 'settings-scroll').waitFor({ timeout: 60000 });
    const key = {
      'zh-CN': 'settings.language.zh',
      en: 'settings.language.en',
      fr: 'settings.language.fr',
    }[choice];
    await page.getByRole('button', { name: texts[choice][key], exact: true }).first().click();
    await wait(page, 400);
    await page.reload();
    await tid(page, 'settings-scroll').waitFor({ timeout: 60000 });
    const body = await page.locator('body').innerText();
    check(
      `language ${choice} still applied after reload`,
      body.includes(texts[choice]['settings.title']),
      body.slice(0, 40).replace(/\n/g, ' '),
    );
    if (choice === 'fr') await shot(page, '74-language-persisted-after-reload-fr');
    await page.goto(base);
    await page.getByTestId('home-continue').waitFor({ timeout: 60000 });
    check(
      `language ${choice}: Home in the same language`,
      (await page.locator('body').innerText()).includes(texts[choice]['home.start']),
    );
    await context.close();
  }
}

const savedSound = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('settings') ?? '{"sound":true}').sound);

// ---- 2. Keyboard (AC 45) ------------------------------------------------------------------------
async function keyboardChecks(browser) {
  const { context, page } = await newPage(browser, 'en', 'seen');
  await page.goto(`${base}/settings`);
  await tid(page, 'settings-scroll').waitFor({ timeout: 60000 });
  const focused = new Set();
  const order = [];
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(
      () =>
        document.activeElement?.getAttribute('data-testid') ||
        document.activeElement?.getAttribute('aria-label') ||
        document.activeElement?.tagName,
    );
    order.push(id);
    focused.add(id);
  }
  console.log(`INFO  Settings Tab order: ${order.join(' > ')}`);
  for (const id of [
    'settings-sound',
    'settings-motion',
    'settings-atari',
    'settings-intro',
    'settings-reset',
  ])
    check(`keyboard: Tab reaches ${id}`, focused.has(id));
  for (const key of ['Space', 'Enter']) {
    await tid(page, 'settings-sound').focus();
    const before = await savedSound(page);
    await page.keyboard.press(key === 'Space' ? ' ' : 'Enter');
    await wait(page, 200);
    const after = await savedSound(page);
    check(`keyboard: ${key} toggles Stone sound`, before !== after, `${before} -> ${after}`);
  }
  // Focus ring.
  await tid(page, 'settings-atari').focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement);
    return { outline: `${cs.outlineStyle} ${cs.outlineWidth}`, shadow: cs.boxShadow };
  });
  check(
    'keyboard: focused row has a visible ring',
    (ring.outline && !/^none/.test(ring.outline)) || ring.shadow !== 'none',
    JSON.stringify(ring),
  );
  // Sheet + Escape.
  await tid(page, 'settings-reset').focus();
  await page.keyboard.press('Enter');
  await wait(page, 300);
  check('keyboard: Enter opens the reset sheet', await has(page, 'settings-reset-keep'));
  await page.keyboard.press('Escape');
  await wait(page, 300);
  check('keyboard: Escape closes the reset sheet', !(await has(page, 'settings-reset-keep')));
  await context.close();
}

// ---- 3. Onboarding (AC 33, 49, 27, 28) ----------------------------------------------------------
async function demoTap(page, vertex, release = true) {
  const box = await tid(page, 'onboarding-demo-board').boundingBox();
  const cell = box.width / 6; // 5x5 with coordinates: (size + 1) cells
  const col = 'abcde'.indexOf(vertex[0]);
  const row = 5 - Number(vertex[1]);
  await page.mouse.move(box.x + (1 + col) * cell, box.y + (1 + row) * cell);
  await page.mouse.down();
  if (release) await page.mouse.up();
  else {
    await wait(page, 50);
    await page.mouse.up();
  }
  await wait(page, 100);
}

async function onboardingChecks(browser) {
  for (const locale of LOCALES) {
    const L = texts[locale];
    const { context, page } = await newPage(browser, locale, 'fresh');
    await page.goto(base);
    await tid(page, 'onboarding-step-1').waitFor({ timeout: 60000 });
    check(
      `[${locale}] fresh install opens the intro`,
      page.url().includes('/onboarding'),
      page.url(),
    );
    await wait(page, 500);
    await shot(page, `65-onboarding-1-welcome-${locale}`);
    await audit(page, `[${locale}] onboarding 1`);
    const wb = await tid(page, 'onboarding-welcome-board').boundingBox();
    check(`[${locale}] welcome board 200 px`, Math.abs(wb.width - 200) < 1.5, `${wb.width}`);
    const nb = await tid(page, 'onboarding-next').boundingBox();
    check(
      `[${locale}] step 1 button pinned inside the view`,
      nb.y + nb.height <= 740 && nb.y >= 0,
      `${nb.y + nb.height}`,
    );
    const skip = await tid(page, 'onboarding-skip').boundingBox();
    check(
      `[${locale}] Skip >= 44`,
      skip.width >= 43.5 && skip.height >= 43.5,
      `${skip.width}x${skip.height}`,
    );
    const body1 = await page.locator('body').innerText();
    check(
      `[${locale}] step 1 shows title and concept`,
      body1.includes(L['onboarding.1.title']) && body1.includes(L['onboarding.1.concept']),
    );
    check(`[${locale}] step 1 button reads "Start learning"`, body1.includes(L['home.start']));

    await click(page, 'onboarding-next');
    await tid(page, 'onboarding-demo-board').waitFor();
    await wait(page, 400);
    await shot(page, `66-onboarding-2-empty-${locale}`);
    const r = await audit(page, `[${locale}] onboarding 2`, { scrollY: false });
    const db = await tid(page, 'onboarding-demo-board').boundingBox();
    check(`[${locale}] demo board >= 280 px`, db.width >= 280, `${db.width}`);
    const fin = await tid(page, 'onboarding-finish').boundingBox();
    check(
      `[${locale}] step 2 button fully visible`,
      fin.y + fin.height <= 740 && fin.height >= 43.5,
      `bottom ${fin.y + fin.height}`,
    );
    check(
      `[${locale}] step 2 fits 740 without page scroll`,
      r.scrollHeight <= 740,
      `${r.scrollHeight}`,
    );

    // Mouse-down shows the ghost, mouse-up the stone (AC 33).
    const cell = db.width / 6;
    await page.mouse.move(db.x + 3 * cell, db.y + 3 * cell);
    await page.mouse.down();
    await wait(page, 150);
    check(
      `[${locale}] mouse-down: ghost, no stone`,
      (await has(page, 'board-ghost')) && !(await has(page, 'board-stone-c3')),
    );
    if (locale !== 'zh-CN' || true) await shot(page, `67-onboarding-2-ghost-${locale}`);
    await page.mouse.up();
    await wait(page, 500);
    check(
      `[${locale}] mouse-up: Black stone on c3 + done line`,
      (await has(page, 'board-stone-c3')) && (await has(page, 'onboarding-demo-done')),
    );
    await shot(page, `68-onboarding-2-placed-${locale}`);
    await audit(page, `[${locale}] onboarding 2 after a stone`, { scrollY: false });
    // Slide off the board: nothing placed.
    await page.mouse.move(db.x + 4 * cell, db.y + 2 * cell);
    await page.mouse.down();
    await page.mouse.move(db.x + db.width + 40, db.y + 2 * cell, { steps: 4 });
    await page.mouse.up();
    await wait(page, 300);
    check(
      `[${locale}] slide off the board places nothing`,
      !(await has(page, 'board-stone-d2')) && !(await has(page, 'board-stone-e3')),
    );
    // Occupied point -> engine message.
    await demoTap(page, 'c3');
    check(
      `[${locale}] occupied point shows the engine message`,
      await has(page, 'onboarding-demo-illegal'),
    );

    if (locale === 'en') {
      await click(page, 'onboarding-finish');
      await page.waitForURL(/lesson\/u01-board/, { timeout: 30000 }).catch(() => {});
      check(
        '[en] "Go to lesson 1" opens lesson 1',
        page.url().includes('/lesson/u01-board'),
        page.url(),
      );
      await wait(page, 800);
      await shot(page, '69-lesson-1-after-intro-en');
      const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('progress') ?? '{}'));
      check('[en] onboardingSeen saved after Finish', seen.flags?.onboardingSeen === true);
    }
    await context.close();
  }
  // Skip -> Home, 70; reload does not show the intro again.
  for (const locale of LOCALES) {
    const { context, page } = await newPage(browser, locale, 'fresh');
    await page.goto(base);
    await tid(page, 'onboarding-skip').waitFor({ timeout: 60000 });
    await click(page, 'onboarding-skip');
    await tid(page, 'home-continue').waitFor({ timeout: 30000 });
    await wait(page, 500);
    check(`[${locale}] Skip lands on Home`, !page.url().includes('onboarding'), page.url());
    await shot(page, `70-home-after-skip-${locale}`);
    await page.reload();
    await tid(page, 'home-continue').waitFor({ timeout: 60000 });
    check(`[${locale}] intro does not return after a reload`, !page.url().includes('onboarding'));
    await context.close();
  }
}

// ---- 4. Home modules (AC 65, 61) + picker (AC 40) -----------------------------------------------
// react-native-web 0.21 drops accessibilityState (no aria-expanded / aria-checked in the DOM), so
// the state is read from what the screen renders: a module's rows exist only while it is open.
const expanded = async (page, n) => String(await has(page, `home-module-${n}-rows`));
async function homeChecks(browser) {
  for (const locale of LOCALES) {
    // 76: new learner.
    let { context, page } = await newPage(browser, locale, 'seen');
    await page.goto(base);
    await tid(page, 'home-module-1').waitFor({ timeout: 60000 });
    await wait(page, 500);
    check(
      `[${locale}] new learner: module 1 open, 2 and 3 collapsed`,
      (await expanded(page, 1)) === 'true' &&
        (await expanded(page, 2)) === 'false' &&
        (await expanded(page, 3)) === 'false',
    );
    await shot(page, `76-home-modules-new-learner-${locale}`);
    await audit(page, `[${locale}] home new learner`);
    for (const n of [1, 2, 3]) {
      const b = await tid(page, `home-module-${n}`).boundingBox();
      check(
        `[${locale}] module ${n} header >= 64 px, full width`,
        b.height >= 63.5 && b.width >= 300,
        `${b.width}x${b.height}`,
      );
      check(
        `[${locale}] module ${n} title <= 2 lines`,
        (await tid(page, `home-module-${n}`).evaluate((el) =>
          Math.max(
            ...[...el.querySelectorAll('div')]
              .filter((d) => d.children.length === 0 && d.textContent.trim().length > 8)
              .map(
                (d) =>
                  d.getBoundingClientRect().height /
                  (parseFloat(getComputedStyle(d).lineHeight) || 20),
              ),
          ),
        )) <= 2.6,
      );
    }
    if (locale === 'en') {
      // 79: locked peek + snackbar.
      await click(page, 'home-module-2');
      check('[en] locked module opens to peek', (await expanded(page, 2)) === 'true');
      const row = page
        .locator('[data-testid^="home-node-"]')
        .filter({ hasText: /Capture Go|Unit 6/i })
        .first();
      await row.click().catch(() => {});
      await wait(page, 400);
      check(
        '[en] tapping a locked row shows the snackbar, no navigation',
        (await has(page, 'home-snackbar')) &&
          !page.url().includes('/lesson/') &&
          !page.url().includes('/practice/'),
        page.url(),
      );
      await shot(page, '79-home-module-locked-peek-en');
      // 82: rows in order.
      await click(page, 'home-module-3');
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid^="home-module-"], [data-testid^="home-node-"]')]
          .filter(
            (e) =>
              /^home-module-\d$/.test(e.getAttribute('data-testid')) ||
              e.getAttribute('data-testid').startsWith('home-node-'),
          )
          .map(
            (e) =>
              (e.getAttribute('data-testid').startsWith('home-module') ? '## ' : '   ') +
              e.getAttribute('data-testid') +
              '  ' +
              e.innerText.replace(/\n/g, ' | ').slice(0, 70),
          ),
      );
      fs.writeFileSync(path.join(SHOTS, '82-home-rows.txt'), rows.join('\n') + '\n');
      check(
        '[en] Home rows list has no "Sample (developer)"',
        !rows.join('\n').includes('Sample (developer)') && rows.length > 10,
        `${rows.length} lines`,
      );
      // 81: keyboard focus on a header.
      await page.reload();
      await tid(page, 'home-module-1').waitFor({ timeout: 60000 });
      let guard = 0;
      while (guard++ < 12) {
        await page.keyboard.press('Tab');
        if (
          (await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))) ===
          'home-module-2'
        )
          break;
      }
      const focusedId = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid'),
      );
      check(
        '[en] keyboard Tab reaches module 2 header',
        focusedId === 'home-module-2',
        `${focusedId}`,
      );
      await shot(page, '81-home-module-header-focus-en');
      const before = await expanded(page, 2);
      await page.keyboard.press('Enter');
      await wait(page, 200);
      check('[en] keyboard Enter toggles the header', (await expanded(page, 2)) !== before);
    }
    await context.close();

    // 78: module 1 done -> module 2 open midway.
    ({ context, page } = await newPage(browser, locale, 'module1Done'));
    await page.goto(base);
    await tid(page, 'home-module-1').waitFor({ timeout: 60000 });
    await wait(page, 500);
    check(
      `[${locale}] module 1 done: module 2 open, 1 and 3 collapsed`,
      (await expanded(page, 2)) === 'true' &&
        (await expanded(page, 1)) === 'false' &&
        (await expanded(page, 3)) === 'false',
    );
    await shot(page, `78-home-module-2-open-midway-${locale}`);
    await audit(page, `[${locale}] home module 2 open`);
    await context.close();

    // 80: module 3 open (module 2 done).
    ({ context, page } = await newPage(browser, locale, 'module2Done'));
    await page.goto(base);
    await tid(page, 'home-module-3').waitFor({ timeout: 60000 });
    await wait(page, 500);
    check(`[${locale}] module 2 done: module 3 open`, (await expanded(page, 3)) === 'true');
    await shot(page, `80-home-module-3-open-${locale}`);
    await audit(page, `[${locale}] home module 3 open`);
    await context.close();

    // 77: finished profile, all collapsed, 9x9 card visible and unlocked.
    ({ context, page } = await newPage(browser, locale, 'all'));
    await page.goto(base);
    await tid(page, 'home-module-1').waitFor({ timeout: 60000 });
    await wait(page, 500);
    check(
      `[${locale}] finished profile: all collapsed`,
      (await expanded(page, 1)) === 'false' &&
        (await expanded(page, 2)) === 'false' &&
        (await expanded(page, 3)) === 'false',
    );
    check(
      `[${locale}] 9x9 card visible without scrolling`,
      (await tid(page, 'home-game9').isVisible()) &&
        (await tid(page, 'home-game9').boundingBox()).y + 40 < 740,
      `${(await tid(page, 'home-game9').boundingBox()).y}`,
    );
    await shot(page, `77-home-modules-all-collapsed-${locale}`);
    await audit(page, `[${locale}] home finished`);
    await context.close();

    // AC 61: the 9x9 card is unlocked from the start (new learner): it opens the picker.
    ({ context, page } = await newPage(browser, locale, 'seen'));
    await page.goto(base);
    await tid(page, 'home-module-1').waitFor({ timeout: 60000 });
    const card = tid(page, 'home-game9');
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await page.waitForURL(/\/game/, { timeout: 15000 }).catch(() => {});
    check(
      `[${locale}] 9x9 card opens the picker for a new learner (AC 61)`,
      page.url().includes('/game'),
      page.url(),
    );
    if (page.url().includes('/game')) {
      await tid(page, 'game9-picker-title').waitFor({ timeout: 30000 });
      await wait(page, 400);
      await audit(page, `[${locale}] picker`, { minRow: 44 });
      const tag = await page
        .locator('[data-testid^="game9-handicap-"][data-testid$="-suggested"]')
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
        .catch(() => null);
      if (tag !== null) check(`[${locale}] picker suggested tag >= 12 px`, tag >= 12, `${tag}`);
      if (locale !== 'zh-CN') await shot(page, `71-picker-suggested-tag-12px-${locale}`);
    }
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox'],
  });
  try {
    await settingsChecks(browser);
    await keyboardChecks(browser);
    await onboardingChecks(browser);
    await homeChecks(browser);
  } finally {
    await browser.close();
  }
  // 72, 73, 75 reports.
  fs.writeFileSync(
    path.join(SHOTS, '72-tap-target-report.txt'),
    'screen\tcontrol\tWxH (px)\n' + tapReport.join('\n') + '\n',
  );
  fs.writeFileSync(path.join(SHOTS, '73-contrast-report.txt'), contrastReport());
  const warnings = consoleLog.filter(
    (l) => !/Failed to load resource|favicon|DevTools|\[HMR\]/.test(l),
  );
  fs.writeFileSync(
    path.join(SHOTS, '75-no-console-warning.txt'),
    warnings.length ? warnings.join('\n') + '\n' : 'No console errors or warnings in this run.\n',
  );
  check(
    'no console errors / warnings (AC 45)',
    warnings.length === 0,
    `${warnings.length}: ${warnings[0] ?? ''}`,
  );
  console.log(`\n${failures.length ? `${failures.length} FAILED` : 'ALL PASSED'}`);
  process.exit(failures.length ? 1 : 0);
}

/** WCAG contrast table of the AC 41 pairs, computed from src/theme/tokens.ts. */
function contrastReport() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'theme', 'tokens.ts'), 'utf8');
  const hex = (block, name) => new RegExp(`${name}:\\s*'(#[0-9A-Fa-f]{6})'`).exec(block)?.[1];
  const colorBlock = /export const color = \{([\s\S]*?)\n\} as const/.exec(src)?.[1] ?? '';
  const boardBlock = /export const board = \{([\s\S]*?)\n\} as const/.exec(src)?.[1] ?? '';
  const stoneBlock = /export const stone = \{([\s\S]*?)\n\} as const/.exec(src)?.[1] ?? '';
  const lum = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const c = (n) => hex(colorBlock, n);
  const pairs = [];
  for (const fg of ['textPrimary', 'textSecondary', 'hint', 'error', 'success'])
    for (const bg of ['background', 'surface']) pairs.push([`${fg} on ${bg}`, c(fg), c(bg), 4.5]);
  pairs.push(
    ['onAccent on accent', c('onAccent'), c('accent'), 4.5],
    ['onBadge on badge', c('onBadge'), c('badge'), 4.5],
  );
  pairs.push(
    ['accent track vs surface', c('accent'), c('surface'), 3],
    ['off-track outline (textSecondary) vs surface', c('textSecondary'), c('surface'), 3],
    ['selected border (success) vs surface', c('success'), c('surface'), 3],
  );
  pairs.push(
    ['hint diamond on bamboo', c('hint'), hex(boardBlock, 'bamboo'), 3],
    ['error ring on bamboo', c('error'), hex(boardBlock, 'bamboo'), 3],
    ['success ring on bamboo', c('success'), hex(boardBlock, 'bamboo'), 3],
    ['black stone on bamboo', hex(stoneBlock, 'black'), hex(boardBlock, 'bamboo'), 3],
    ['white-stone edge on bamboo', hex(stoneBlock, 'whiteEdge'), hex(boardBlock, 'bamboo'), 3],
  );
  const out = ['pair\tfg\tbg\tratio\ttarget\tresult'];
  for (const [name, fg, bg, target] of pairs) {
    const r = ratio(fg, bg);
    out.push(
      `${name}\t${fg}\t${bg}\t${r.toFixed(2)}\t>=${target}\t${r >= target ? 'pass' : 'FAIL'}`,
    );
  }
  return out.join('\n') + '\n';
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
