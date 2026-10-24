// Every lesson file shipped with the app. Metro bundles only static imports, so a new lesson is
// one import line plus one entry below. The i18n JSON files are imported as plain data so the
// loader can check that every text key exists (no React / i18next here).
import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import zhCN from '@/i18n/zh-CN.json';

import u01Board from './content/u01-board.json';
import u02Liberties from './content/u02-liberties.json';
import u03Connection from './content/u03-connection.json';
import u04Capture from './content/u04-capture.json';
import u05Atari from './content/u05-atari.json';
import u05Review from './content/u05-review.json';
import u06CaptureGo from './content/u06-capture-go.json';
import u06Checkpoint from './content/u06-checkpoint.json';
import u07Forbidden from './content/u07-forbidden.json';
import u08Ko from './content/u08-ko.json';
import u09Ladder from './content/u09-ladder.json';
import u09Review from './content/u09-review.json';
import u10Eyes from './content/u10-eyes.json';
import u11Review from './content/u11-review.json';
import u11TwoEyes from './content/u11-two-eyes.json';
import u11Vital from './content/u11-vital.json';
import u12Territory from './content/u12-territory.json';
import u13Counting from './content/u13-counting.json';
import u14End from './content/u14-end.json';
import u14Review from './content/u14-review.json';
import type { Language } from './schema';

export const LESSON_FILES: readonly unknown[] = [
  u01Board,
  u02Liberties,
  u03Connection,
  u04Capture,
  u05Atari,
  u05Review,
  u06CaptureGo,
  u06Checkpoint,
  u07Forbidden,
  u08Ko,
  u09Ladder,
  u09Review,
  u10Eyes,
  u11TwoEyes,
  u11Vital,
  u11Review,
  u12Territory,
  u13Counting,
  u14End,
  u14Review,
];

export const LESSON_TEXTS: Readonly<Record<Language, Readonly<Record<string, string>>>> = {
  'zh-CN': zhCN,
  en,
  fr,
};
