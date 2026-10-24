// docs/specs/M6-eas-build.md §4.1, §4.2, §4.4: eas.json and app.json shape, splash colour.
import fs from 'node:fs';
import path from 'node:path';

import { color } from '@/theme/tokens';

const ROOT = path.join(__dirname, '..');
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

const eas = readJson('eas.json');
const { expo } = readJson('app.json');
const PACKAGE_ID = 'com.agneslain.letsgo';

describe('eas.json (AC 1–5)', () => {
  it('pins the CLI with a >= constraint and keeps build numbers on EAS (AC 1)', () => {
    expect(eas.cli.version).toMatch(/^>=\s*\d+\.\d+\.\d+$/);
    expect(eas.cli.appVersionSource).toBe('remote');
  });

  it('development: dev client, internal, APK (AC 2)', () => {
    const p = eas.build.development;
    expect(p.developmentClient).toBe(true);
    expect(p.distribution).toBe('internal');
    expect(p.android.buildType).toBe('apk');
  });

  it('preview: internal APK, no dev client, channel preview (AC 3)', () => {
    const p = eas.build.preview;
    expect(p.distribution).toBe('internal');
    expect(p.android.buildType).toBe('apk');
    expect(p.developmentClient).toBeUndefined();
    expect(p.channel).toBe('preview');
  });

  it('production: store AAB with auto-increment, channel production (AC 4)', () => {
    const p = eas.build.production;
    expect(p.autoIncrement).toBe(true);
    expect(p.distribution ?? 'store').toBe('store');
    expect(p.android.buildType).toBe('app-bundle');
    expect(p.channel).toBe('production');
  });

  it('submits to Play internal testing as a draft, with no secret and no iOS block (AC 5)', () => {
    expect(eas.submit.production.android).toEqual({ track: 'internal', releaseStatus: 'draft' });
    expect(eas.submit.production.ios).toBeUndefined();
    expect(JSON.stringify(eas)).not.toMatch(/password|serviceAccountKeyPath|private_key/i);
    const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n');
    expect(gitignore).toContain('*service-account*.json');
    expect(gitignore).toEqual(expect.arrayContaining(['/ios', '/android']));
    const committedKeys = fs.readdirSync(ROOT).filter((f) => /service-account.*\.json$/.test(f));
    expect(committedKeys).toEqual([]);
  });
});

describe('app.json (AC 7–11)', () => {
  it('uses the permanent package id on Android (and iOS, for later) (AC 7)', () => {
    const idPattern = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$/;
    expect(expo.android.package).toBe(PACKAGE_ID);
    expect(expo.ios.bundleIdentifier).toBe(PACKAGE_ID);
    expect(expo.android.package).toMatch(idPattern);
  });

  it('has version 0.1.0 and no hand-written build numbers (AC 8)', () => {
    expect(expo.version).toBe('0.1.0');
    expect(expo.android).not.toHaveProperty('versionCode');
    expect(expo.ios).not.toHaveProperty('buildNumber');
  });

  it('declares no encryption on iOS and no extra Android permissions (AC 9)', () => {
    expect(expo.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(expo.android.permissions).toEqual([]);
    // The Expo template adds these; block them so Play shows no storage or overlay permission.
    expect(expo.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ]),
    );
  });

  it('is phone-only, portrait and light (AC 10)', () => {
    expect(expo.ios.supportsTablet).toBe(false);
    expect(expo.orientation).toBe('portrait');
    expect(expo.userInterfaceStyle).toBe('light');
  });

  it('keeps its scheme, name and slug (AC 11)', () => {
    expect(expo.scheme).toBe('letsgo');
    expect(expo.name).toBe("Let's GO");
    expect(expo.slug).toBe('lets-go');
  });

  it('turns off the microphone and background audio of expo-audio (no RECORD_AUDIO)', () => {
    const audio = expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-audio');
    expect(audio[1]).toEqual({
      microphonePermission: false,
      recordAudioAndroid: false,
      enableBackgroundPlayback: false,
    });
  });

  it('adds no analytics, ads, crash-reporting or network SDK (AC 32)', () => {
    const pkg = readJson('package.json');
    const names = [
      ...Object.keys(pkg.dependencies),
      ...Object.keys(pkg.devDependencies),
      ...expo.plugins.map((p: string | [string]) => (Array.isArray(p) ? p[0] : p)),
    ];
    const banned =
      /analytics|firebase|sentry|bugsnag|crashlytics|admob|ads|amplitude|mixpanel|segment|axios|expo-updates|expo-notifications/i;
    expect(names.filter((n) => banned.test(n))).toEqual([]);
  });
});

describe('splash screen (AC 23–25)', () => {
  const splash = expo.plugins.find(
    (p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen',
  );

  it('configures expo-splash-screen with the stones on rice paper, no dark variant (AC 24)', () => {
    expect(splash[1]).toEqual({
      image: './assets/splash-icon.png',
      imageWidth: 200,
      resizeMode: 'contain',
      backgroundColor: '#F4F1EA',
    });
    expect(expo).not.toHaveProperty('splash');
  });

  it('uses the app background token as its colour (AC 25)', () => {
    expect(splash[1].backgroundColor).toBe(color.background);
  });

  it('has its SVG source and a 1024×1024 PNG with alpha (AC 23)', () => {
    expect(fs.existsSync(path.join(ROOT, 'assets/icon-source/splash.svg'))).toBe(true);
    const png = fs.readFileSync(path.join(ROOT, 'assets/splash-icon.png'));
    // IHDR: width and height (big-endian) at bytes 16–23, colour type at byte 25 (6 = RGBA).
    expect(png.readUInt32BE(16)).toBe(1024);
    expect(png.readUInt32BE(20)).toBe(1024);
    expect(png[25]).toBe(6);
  });
});
