// Spec docs/specs/M6-game-coaching.md AC 11, 36: every coach.* key in the three languages, the
// Chinese terms with pinyin, and the note lines short enough for a 360 px screen.
import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import zhCN from '@/i18n/zh-CN.json';

const files: Record<string, Record<string, string>> = { 'zh-CN': zhCN, en, fr };
const coachKeys = (file: Record<string, string>) =>
  Object.keys(file)
    .filter((k) => k.startsWith('coach.'))
    .sort();

/** A note line with the worst-case parameters: a 2-letter point and a 2-digit count. */
const fill = (text: string) =>
  text.replace(/\{\{point\}\}/g, 'e4').replace(/\{\{(count|n)\}\}/g, '12');

describe('coach copy (AC 11, 36)', () => {
  it('the three files have the same coach.* keys', () => {
    expect(coachKeys(en).length).toBeGreaterThan(30);
    expect(coachKeys(fr)).toEqual(coachKeys(zhCN));
    expect(coachKeys(en)).toEqual(coachKeys(zhCN));
  });

  it.each(Object.keys(files))('%s note lines fit (≤ 60 chars en/fr, ≤ 28 zh-CN)', (language) => {
    const max = language === 'zh-CN' ? 28 : 60;
    const file = files[language];
    const notes = Object.keys(file).filter((k) => /^coach\.(you|bot)\./.test(k));
    expect(notes.length).toBeGreaterThanOrEqual(13);
    for (const key of notes) {
      const line = fill(file[key]);
      expect({ key, line, fits: [...line].length <= max }).toEqual({ key, line, fits: true });
    }
  });

  // PO 2026-10-23: Chinese + pinyin only for Weiqi terms (气 qì); everyday labels (Hint, Review) stay plain.
  it.each(Object.keys(files))(
    '%s: 气 qì keeps its pinyin; Hint and Review are plain words',
    (language) => {
      const file = files[language];
      expect(file['coach.you.selfAtari_one']).toContain('气 qì');
      for (const key of ['coach.hint.button', 'coach.hint.buttonFree', 'coach.review.button']) {
        const text = file[key].replace(/\{\{\w+\}\}/g, '');
        if (language === 'zh-CN')
          expect({ key, text }).toEqual({ key, text: text.replace(/[a-zà-ü]/gi, '') });
        else expect({ key, text }).toEqual({ key, text: text.replace(/[\u4e00-\u9fff]/g, '') });
      }
    },
  );

  it('never says "mistake" / "blunder" / "erreur" / "错"', () => {
    for (const file of Object.values(files)) {
      for (const key of coachKeys(file)) {
        expect({ key, text: file[key] }).not.toEqual({
          key,
          text: expect.stringMatching(/mistake|blunder|erreur|faute|错/i),
        });
      }
    }
  });
});
