// The M6 settings / onboarding / Home-module copy (docs/specs/M6-settings-onboarding-a11y.md §6),
// verbatim in zh-CN, en and fr. French typography: a no-break space before : ; ? ! and inside « ».
import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import zhCN from '@/i18n/zh-CN.json';

const FILES: Record<string, Record<string, string>> = { 'zh-CN': zhCN, en, fr };
const nbsp = (text: string) => text.replace(/ ([:;?!»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');

const TABLE: [string, string, string, string][] = [
  ['settings.section.sound', '声音与动画', 'Sound and motion', 'Son et animations'],
  ['settings.sound', '落子声音', 'Stone sound', 'Son des pierres'],
  [
    'settings.sound.desc',
    '落子时发出轻轻的一声。',
    'A soft tock when a stone lands.',
    'Un petit « toc » quand une pierre se pose.',
  ],
  ['settings.motion', '减少动画', 'Reduce motion', 'Réduire les animations'],
  [
    'settings.motion.desc',
    '减少移动和渐变效果。',
    'Fewer moving and fading effects.',
    'Moins de mouvements et de fondus.',
  ],
  [
    'settings.motion.osOn',
    '手机的“减弱动态效果”已开启，这里同步生效。',
    "Your phone's reduce-motion setting is on, so this is on too.",
    "Le réglage « réduire les animations » de votre téléphone est activé, celui-ci l'est donc aussi.",
  ],
  ['settings.section.games', '对局', 'Games', 'Parties'],
  ['settings.section.help', '帮助', 'Help', 'Aide'],
  ['settings.intro', '再看一遍入门介绍', 'Show the intro again', "Revoir l'introduction"],
  ['settings.section.progress', '学习记录', 'Progress', 'Progression'],
  ['settings.reset', '清除学习记录', 'Erase progress', 'Effacer la progression'],
  [
    'settings.reset.title',
    '清除所有学习记录？',
    'Erase all progress?',
    'Effacer toute la progression ?',
  ],
  [
    'settings.reset.body',
    '星星、对局记录和让子建议都会从这台手机上删除，无法恢复。语言等设置不变。',
    'Your stars, game record and handicap suggestions will be deleted from this phone. This cannot be undone. Your settings stay.',
    "Vos étoiles, votre historique de parties et vos suggestions de handicap seront supprimés de ce téléphone. C'est irréversible. Vos réglages restent.",
  ],
  ['settings.reset.keep', '保留', 'Keep my progress', 'Garder ma progression'],
  ['settings.reset.confirm', '清除', 'Erase', 'Effacer'],
  ['settings.reset.done', '学习记录已清除。', 'Progress erased.', 'Progression effacée.'],
  ['onboarding.skip', '跳过', 'Skip', 'Passer'],
  // §12c.5: step 1's button is Next, step 2's is Done (the intro no longer opens lesson 1).
  ['onboarding.next', '下一步', 'Next', 'Suivant'],
  ['onboarding.done', '完成', 'Done', 'Terminé'],
  [
    'onboarding.step',
    '第 {{n}} 步，共 {{total}} 步',
    'Step {{n}} of {{total}}',
    'Étape {{n}} sur {{total}}',
  ],
  [
    'onboarding.1.title',
    '从零开始学围棋',
    'Learn Go (围棋 wéiqí) from zero',
    'Apprenez le Go (围棋 wéiqí) à partir de zéro',
  ],
  [
    'onboarding.1.concept',
    '一步一步来：每一课只学一个规则，再做几道小练习，拿星星。学完之后，在 9×9 的小棋盘上和友好的电脑对弈。',
    'Step by step: each lesson teaches one rule, then a few short exercises and stars. At the end you play games on a small 9×9 board against a friendly bot.',
    'Pas à pas : chaque leçon enseigne une règle, puis quelques exercices courts et des étoiles. À la fin, vous jouez sur un petit plateau 9×9 contre un robot sympathique.',
  ],
  [
    'onboarding.1.body',
    '围棋是两个人下的游戏：黑和白轮流把棋子放在线的交叉点上。围住比对手更多的地方，就能获胜。',
    'Go is a game for two players: Black and White take turns placing stones on the crossings of the lines. Surround more space than your opponent to win.',
    "Le Go se joue à deux : Noir et Blanc posent à tour de rôle une pierre sur les croisements des lignes. Entourez plus d'espace que votre adversaire pour gagner.",
  ],
  ['onboarding.2.title', '试着放一颗棋子', 'Try placing a stone', 'Essayez de poser une pierre'],
  [
    'onboarding.2.body',
    '手指按在一个交叉点上，会先出现浅色的预览；手指抬起，棋子才落下。',
    'Touch a crossing to see a faint preview. The stone lands when you lift your finger.',
    'Touchez un croisement pour voir un aperçu pâle. La pierre se pose quand vous levez le doigt.',
  ],
  [
    'onboarding.2.hint',
    '位置不对？抬起之前滑到别的交叉点就行。',
    'Not the right spot? Slide to another crossing before you lift.',
    'Pas le bon endroit ? Glissez vers un autre croisement avant de lever le doigt.',
  ],
  [
    'onboarding.2.done',
    '很好！下一手棋就这么简单。',
    'Nicely done. That is all it takes to play a move.',
    "Bien joué. C'est tout ce qu'il faut pour jouer un coup.",
  ],
  [
    'onboarding.a11y.demo',
    '练习棋盘，5 乘 5。双击一个交叉点来放黑子。',
    'Practice board, 5 by 5. Double-tap a crossing to place a stone.',
    "Plateau d'essai, 5 par 5. Touchez deux fois un croisement pour poser une pierre.",
  ],
  [
    'onboarding.a11y.board1',
    '示例棋盘：黑 b3、c3；白 c4、d3。',
    'Example board: Black b3, c3; White c4, d3.',
    "Plateau d'exemple : Noir b3, c3 ; Blanc c4, d3.",
  ],
  ['home.module.1.title', '基础入门', 'The basics', 'Les bases'],
  ['home.module.2.title', '和对手下棋', 'Playing an opponent', 'Jouer face à un adversaire'],
  ['home.module.3.title', '怎样赢棋', 'How to win a game', 'Comment gagner une partie'],
  ['home.module.label', '模块 {{n}}', 'Module {{n}}', 'Module {{n}}'],
  [
    'home.module.units',
    '第 {{from}}–{{to}} 单元',
    'Units {{from}}–{{to}}',
    'Unités {{from}}–{{to}}',
  ],
  [
    'home.module.progress',
    '已完成 {{done}}/{{total}}',
    '{{done}} of {{total}} done',
    '{{done}} sur {{total}} faits',
  ],
  ['home.module.locked', '未解锁', 'Locked', 'Verrouillé'],
  [
    'home.module.a11y',
    '{{label}}，{{title}}，{{units}}，{{progress}}',
    '{{label}}, {{title}}, {{units}}, {{progress}}',
    '{{label}}, {{title}}, {{units}}, {{progress}}',
  ],
  [
    'home.module.a11y.locked',
    '未解锁，先完成上一个模块',
    'locked, finish the previous module first',
    "verrouillé, terminez d'abord le module précédent",
  ],
  // The 12 px handicap chip tag (AC 40): en "suggested" was cut to "suggest…" in a 360 px chip.
  ['game9.picker.suggested', '推荐', 'advised', 'conseillé'],
];

describe('§6 copy keys', () => {
  it.each(TABLE)('%s', (key, zh, english, french) => {
    expect(FILES['zh-CN'][key]).toBe(zh);
    expect(FILES.en[key]).toBe(english);
    expect(FILES.fr[key]).toBe(nbsp(french));
  });

  it('removed keys are gone from every file', () => {
    for (const file of Object.values(FILES)) {
      const keys = Object.keys(file);
      expect(
        keys.filter((k) => k === 'home.sample.label' || k.startsWith('lesson.u00-sample.')),
      ).toEqual([]);
      expect(keys.filter((k) => k === 'onboarding.start' || k.startsWith('onboarding.3.'))).toEqual(
        [],
      );
      expect(keys).not.toContain('game9.entry.locked');
    }
  });

  it('zh-CN buttons carry no pinyin; en/fr only the taught term Go (围棋 wéiqí)', () => {
    const pinyin = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
    for (const [key] of TABLE) {
      expect({ key, pinyin: pinyin.test(FILES['zh-CN'][key]) }).toEqual({ key, pinyin: false });
      for (const lang of ['en', 'fr']) {
        const text = FILES[lang][key];
        const hasHan = /[\u4e00-\u9fff]/.test(text);
        expect({ key, lang, ok: !hasHan || text.includes('围棋 wéiqí') }).toEqual({
          key,
          lang,
          ok: true,
        });
      }
    }
  });
});
