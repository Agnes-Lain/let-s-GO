// docs/specs/M6-eas-build.md AC 30–31: the privacy policy, store texts and PO checklist exist, every
// locale has every field, and the store texts fit Google Play's limits.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

/** Play counts characters (code points), not bytes. */
const length = (text: string) => [...text].length;

const LISTING_LOCALES = ['en-US', 'zh-CN', 'fr-FR'];
const LIMITS: Record<string, number> = {
  'App name': 30,
  'Short description': 80,
  'Full description': 4000,
};

/** `## locale` → `### Field (max N)` → the fenced ```text block under it. */
function parseListing(markdown: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const section of markdown.split(/^## /m).slice(1)) {
    const locale = section.split('\n')[0].trim();
    result[locale] = {};
    for (const field of section.split(/^### /m).slice(1)) {
      const name = field.split('\n')[0].replace(/\s*\(max \d+\)\s*$/, '');
      const text = field.match(/```text\n([\s\S]*?)\n```/);
      if (text) result[locale][name] = text[1];
    }
  }
  return result;
}

describe('store listing (AC 30)', () => {
  const listing = parseListing(read('docs/store/listing.md'));

  it('has every field in every locale', () => {
    expect(Object.keys(listing).sort()).toEqual([...LISTING_LOCALES].sort());
    for (const locale of LISTING_LOCALES) {
      expect(Object.keys(listing[locale]).sort()).toEqual(Object.keys(LIMITS).sort());
    }
  });

  it.each(LISTING_LOCALES)('%s fits the Play limits', (locale) => {
    for (const [field, limit] of Object.entries(LIMITS)) {
      const text = listing[locale][field];
      expect(text.trim().length).toBeGreaterThan(0);
      expect([field, length(text)]).toEqual([field, Math.min(length(text), limit)]);
    }
  });

  it('keeps the app name "Let\'s GO" everywhere', () => {
    for (const locale of LISTING_LOCALES) expect(listing[locale]['App name']).toBe("Let's GO");
  });

  it('ships the Play graphics', () => {
    const size = (file: string) => {
      const png = fs.readFileSync(path.join(ROOT, file));
      return [png.readUInt32BE(16), png.readUInt32BE(20)];
    };
    expect(size('docs/store/icon-512.png')).toEqual([512, 512]);
    expect(size('docs/store/feature-graphic.png')).toEqual([1024, 500]);
    const shots = fs
      .readdirSync(path.join(ROOT, 'docs/store'))
      .filter((f) => /^screenshot-.*\.png$/.test(f));
    expect(shots.length).toBeGreaterThanOrEqual(2);
    for (const shot of shots) expect(size(`docs/store/${shot}`)).toEqual([1080, 1920]);
  });
});

describe('privacy policy (AC 31)', () => {
  const policy = read('docs/privacy-policy.md');
  const sections = Object.fromEntries(
    policy
      .split(/^## /m)
      .slice(1)
      .map((s) => [s.split('\n')[0].trim(), s]),
  );

  it('has a 中文, English and Français section, each with the contact email', () => {
    expect(Object.keys(sections).sort()).toEqual(['English', 'Français', '中文'].sort());
    for (const text of Object.values(sections)) expect(text).toContain('gameonelewagon@gmail.com');
  });

  it.each([
    [
      'English',
      ['account', 'advertising', 'analytics', 'tracking', 'offline', 'device', 'uninstall'],
    ],
    [
      'Français',
      ['compte', 'publicité', 'analyse', 'suivi', 'hors ligne', 'appareil', 'désinstallant'],
    ],
    ['中文', ['账号', '广告', '数据分析', '跟踪', '离线', '设备', '卸载']],
  ])('%s states every promise of §7', (locale, words) => {
    for (const word of words) expect(sections[locale as string]).toContain(word);
  });
});

describe('PO checklist (AC 30, spec §6)', () => {
  const checklist = read('docs/specs/M6-eas-build-po-checklist.md');

  it.each([
    'npx eas-cli login',
    'npx eas-cli init',
    'eas build -p android --profile preview',
    'eas build -p android --profile production',
    'Internal testing',
    'lets-go-privacy',
    'https://agnes-lain.github.io/lets-go-privacy/',
    '<support email>',
    'Version code',
    '12 testers',
    'Generate a new Android Keystore',
  ])('mentions %s', (text) => {
    expect(checklist).toContain(text);
  });
});

describe('public legal page (site/legal/index.html)', () => {
  const html = read('site/legal/index.html');

  it.each(['zh-CN', 'en', 'fr'])(
    'has a section with id "%s" (the anchor Settings links to)',
    (id) => {
      expect(html).toMatch(new RegExp(`<section id="${id}" lang="${id}">`));
    },
  );

  it('names the publisher, the contact, the host and the privacy terms in every language', () => {
    const sections = html.split('<section ').slice(1);
    expect(sections).toHaveLength(3);
    for (const section of sections) {
      expect(section).toContain('Agnes-Lain');
      expect(section).toContain('mailto:gameonelewagon@gmail.com');
      expect(section).toContain('GitHub, Inc.');
    }
    expect(html).not.toContain('<support email>');
  });

  it('is deployed by the Pages workflow from site/', () => {
    expect(read('.github/workflows/pages.yml')).toMatch(/path: site\b/);
  });
});
