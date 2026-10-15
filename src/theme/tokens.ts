/**
 * Visual foundation — mood 山水 · 茶 · 竹 (mountains, misty sky, tea, bamboo board).
 * Values come from docs/specs/M0-project-setup.md §6. Light mode only in M0.
 */

export const color = {
  /** 宣纸 rice paper — app background */
  background: '#F4F1EA',
  /** 晨雾 morning mist — top-of-screen mist gradient (→ background) */
  sky: '#DCE6EA',
  /** 素绢 silk — cards, rows */
  surface: '#FFFDF8',
  /** 淡墨 pale ink — card/row dividers */
  border: '#E3DDD0',
  /** 墨 ink — main text */
  textPrimary: '#26292B',
  /** 远山 distant mountain — subtitles, captions */
  textSecondary: '#5E6A6E',
  /** 青山 green mountain — primary buttons, check marks, links */
  accent: '#3E6461',
  /** text on accent */
  onAccent: '#FFFFFF',
  /** 茶 tea green — correct answer (M3+) */
  success: '#56764A',
  /** 胭脂 rouge — wrong answer (M3+), gentle not alarming */
  error: '#A8443F',
  /** 琥珀茶 amber tea — hint highlight (M3+) */
  hint: '#9A5F22',
  /** 嫩芽 tea sprout — "coming soon" badge background */
  badge: '#E4ECD8',
  /** badge text */
  onBadge: '#3F5A35',
  /** 远山 far ridge — decorative landscape layer */
  mountainFar: '#C9D5D6',
  /** 近山 near ridge — decorative landscape layer */
  mountainNear: '#9DB2AE',
} as const;

/** Laminated bamboo board (竹制棋盘), drawn in M2. */
export const board = {
  /** 竹板 bamboo — board base color */
  bamboo: '#E8D3A0',
  /** alternating light strip */
  bambooStripLight: '#EEDCAE',
  /** alternating darker strip */
  bambooStripDark: '#DEC68C',
  /** 竹节 node — thin horizontal node marks on strips */
  bambooNode: '#CDB277',
  /** grid lines, star points */
  line: '#33281B',
} as const;

export const stone = {
  /** 墨玉 ink jade — black stone */
  black: '#22252A',
  /** 贝 shell — white stone fill */
  white: '#F7F5EE',
  /** 1px outline so white stones read on wood */
  whiteEdge: '#8F8C80',
} as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  pill: 999,
} as const;

export const tapTarget = {
  /** Minimum width/height of every pressable (px). */
  min: 44,
} as const;

export const tokens = { color, board, stone, typography, spacing, radius, tapTarget } as const;
