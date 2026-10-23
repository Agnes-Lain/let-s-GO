// 9×9 bot tuning report (spec docs/specs/M6-bot-levels.md AC 7–9, §14).
//
// Plays seeds 1–N per pairing, each seed once with each colour (komi 5.5), ends every game by
// two passes, counts it with the dead stones of the bots' own proposal and prints win rates,
// game lengths and the time per move of each level (desktop Node, Date.now()).
//
//   npm run tune:bot9                                  # all pairings, seeds 1–100
//   TUNE_SEEDS=20 TUNE_PAIRS=L2-L1,L3-L2 npm run tune:bot9
//   TUNE_BLUNDER=0.6 npm run tune:bot9                 # level-1 (Easy) blunder to try
//   TUNE_SKIP_SAVE=0.4 TUNE_SKIP_ATARI=0.3 TUNE_SLIP=0.2 npm run tune:bot9   # softer Easy / Normal
//   TUNE_HANDICAP=4 TUNE_LEVELS=1,2 npm run tune:bot9  # handicap table only (M6-beginner-friendly AC 41)
//
// Runs under Jest (for the `@/` paths and TS) with its own config: NOT part of `npm test`. It
// fails only on a hard error (AC 9: a throw, an illegal move, a game over 202 plies or one that
// does not end by two passes); the win rates are a report for the product owner.
import { createGame, pass, play, score, type Color, type GameState } from '@/engine';
import { botRng, chooseMove, proposeDead, type BotLevel } from '@/bot';
import {
  GAME_KOMI_9,
  L1_BLUNDER_9,
  L1_SKIP_ATARI_9,
  L1_SKIP_SAVE_9,
  L2_SLIP_9,
} from '@/game9/config';
import { HANDICAP_KOMI, handicapStones } from '@/game9/handicap';

type PlayerId = 'L1' | 'L2' | 'L3' | 'Sensible' | 'Noob';

const SEEDS = Number(process.env.TUNE_SEEDS ?? 100);
const BLUNDER = Number(process.env.TUNE_BLUNDER ?? L1_BLUNDER_9);
const SKIP_SAVE = Number(process.env.TUNE_SKIP_SAVE ?? L1_SKIP_SAVE_9);
const SKIP_ATARI = Number(process.env.TUNE_SKIP_ATARI ?? L1_SKIP_ATARI_9);
const SLIP = Number(process.env.TUNE_SLIP ?? L2_SLIP_9);
/** M6-beginner-friendly AC 41: handicap n → only the handicap table (learner = Black). */
const HANDICAP = process.env.TUNE_HANDICAP ? Number(process.env.TUNE_HANDICAP) : 0;
const LEVELS = (process.env.TUNE_LEVELS ?? '1,2,3').split(',').map(Number) as BotLevel[];

/**
 * Noob (M6-beginner-friendly AC 38): a weak beginner who just finished the lessons — level-1
 * rules of thumb that misses a quarter of its captures and saves (blunder 0.25: capture missed
 * 12.5 %, any move 25 %; skipSave 0.25), never fills its own eyes (board9).
 */
const NOOB = { level: 1 as BotLevel, blunder: 0.25, skipSave: 0.25, skipAtari: 0, slip: 0 };

/** Spec AC 8 targets: A beats B at least this often. */
const PAIRS: { a: PlayerId; b: PlayerId; target: string; min: number; max?: number }[] = [
  { a: 'L2', b: 'L1', target: 'L2 beats L1 ≥ 80 %', min: 80 },
  { a: 'L3', b: 'L2', target: 'L3 beats L2 ≥ 65 %', min: 65 },
  { a: 'L3', b: 'L1', target: 'L3 beats L1 ≥ 90 %', min: 90 },
  { a: 'Sensible', b: 'L1', target: 'Sensible beats L1 90–95 %', min: 90, max: 95 },
  { a: 'Noob', b: 'L1', target: 'Noob beats L1 ≥ 50 %', min: 50 },
  { a: 'Sensible', b: 'L2', target: 'Sensible beats L2 50–60 % (≥ 40 % minimum)', min: 40 },
  { a: 'Noob', b: 'L2', target: 'report only', min: 0 },
  { a: 'Sensible', b: 'L3', target: 'Sensible loses to L3 ≥ 60 % (wins ≤ 40 %)', min: 0, max: 40 },
  { a: 'Noob', b: 'L3', target: 'report only', min: 0 },
];

const selected = process.env.TUNE_PAIRS?.split(',');

interface Settings {
  level: BotLevel;
  blunder: number;
  skipSave: number;
  skipAtari: number;
  slip: number;
}

/** A player's bot options. Sensible = level 1, no mistakes, never fills own eyes. */
function settings(id: PlayerId): Settings {
  const none = { blunder: 0, skipSave: 0, skipAtari: 0, slip: 0 };
  switch (id) {
    case 'L1':
      return { level: 1, blunder: BLUNDER, skipSave: SKIP_SAVE, skipAtari: SKIP_ATARI, slip: 0 };
    case 'Sensible':
      return { level: 1, ...none };
    case 'Noob':
      return NOOB;
    case 'L2':
      return { level: 2, ...none, slip: SLIP };
    case 'L3':
      return { level: 3, ...none };
  }
}

const isBot = (id: PlayerId) => id === 'L1' || id === 'L2' || id === 'L3';

const timing: Record<BotLevel, number[]> = { 1: [], 2: [], 3: [] };

interface GameResult {
  winner: Color | null;
  plies: number;
  margin: number;
}

function playGame(black: PlayerId, white: PlayerId, seed: number, handicap = 0): GameResult {
  const komi = handicap > 0 ? HANDICAP_KOMI : GAME_KOMI_9;
  let state: GameState =
    handicap > 0
      ? createGame(9, { komi, setup: { B: handicapStones(handicap) }, toPlay: 'W' })
      : createGame(9, { komi });
  while (!state.isOver) {
    const id = state.toPlay === 'B' ? black : white;
    const rngSeed = seed * 2 + (state.toPlay === 'B' ? 0 : 1);
    const started = Date.now();
    const { move } = chooseMove(state, {
      ...settings(id),
      board9: true,
      rng: botRng(rngSeed, state.moves.length),
    });
    if (isBot(id)) timing[settings(id).level].push(Date.now() - started);
    const result = move.type === 'pass' ? pass(state) : play(state, move.point);
    if (!result.ok) throw new Error(`${id} played an illegal move: ${result.reason}`);
    state = result.state;
    if (state.moves.length > 202) throw new Error(`game over 202 plies (seed ${seed})`);
  }
  if (state.consecutivePasses !== 2) throw new Error('game did not end by two passes');
  const deadStones = proposeDead(state, botRng(seed, 0xdead));
  const counted = score(state.board, { komi, deadStones });
  return { winner: counted.winner, plies: state.moves.length, margin: counted.margin };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

const constants = () =>
  `L1 blunder ${BLUNDER}, skipSave ${SKIP_SAVE}, skipAtari ${SKIP_ATARI}; L2 slip ${SLIP}`;

/** AC 41: Sensible and Noob (Black, n stones, komi 0.5) against each level. */
function handicapReport(): string[] {
  const lines = [
    `9×9 handicap ${HANDICAP} — seeds 1–${SEEDS}, learner Black, White first, komi ${HANDICAP_KOMI}; ${constants()}`,
    '| Level | Sensible wins | Noob wins | Plies (mean) |',
    '|---|---|---|---|',
  ];
  for (const level of LEVELS) {
    const bot = `L${level}` as PlayerId;
    const wins: Record<string, number> = { Sensible: 0, Noob: 0 };
    const plies: number[] = [];
    for (const learner of ['Sensible', 'Noob'] as const) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const game = playGame(learner, bot, seed, HANDICAP);
        if (game.winner === 'B') wins[learner]++;
        plies.push(game.plies);
      }
    }
    const pct = (n: number) => `${((100 * n) / SEEDS).toFixed(1)} %`;
    const mean = plies.reduce((n, p) => n + p, 0) / plies.length;
    lines.push(`| L${level} | ${pct(wins.Sensible)} | ${pct(wins.Noob)} | ${mean.toFixed(0)} |`);
  }
  return lines;
}

it('prints the 9×9 tuning report', () => {
  if (HANDICAP > 0) {
    console.log(handicapReport().join('\n'));
    return;
  }
  const lines: string[] = [
    `9×9 bot tuning — seeds 1–${SEEDS} × both colours, komi ${GAME_KOMI_9}; ${constants()}`,
    '| Pairing (A vs B) | A wins | A as Black | A as White | Plies (mean / max) | Target | OK |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const pair of PAIRS) {
    const name = `${pair.a}-${pair.b}`;
    if (selected && !selected.includes(name)) continue;
    let winsBlack = 0;
    let winsWhite = 0;
    const plies: number[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const asBlack = playGame(pair.a, pair.b, seed);
      const asWhite = playGame(pair.b, pair.a, seed);
      if (asBlack.winner === 'B') winsBlack++;
      if (asWhite.winner === 'W') winsWhite++;
      plies.push(asBlack.plies, asWhite.plies);
    }
    const rate = (100 * (winsBlack + winsWhite)) / (2 * SEEDS);
    const ok = rate >= pair.min && (pair.max === undefined || rate <= pair.max);
    const mean = plies.reduce((n, p) => n + p, 0) / plies.length;
    lines.push(
      `| ${pair.a} vs ${pair.b} | ${rate.toFixed(1)} % | ${winsBlack}/${SEEDS} | ${winsWhite}/${SEEDS} | ` +
        `${mean.toFixed(0)} / ${Math.max(...plies)} | ${pair.target} | ${ok ? 'yes' : 'NO'} |`,
    );
  }
  lines.push('', '| Level | Moves timed | Mean ms | p95 ms | Max ms |', '|---|---|---|---|---|');
  for (const level of [1, 2, 3] as BotLevel[]) {
    const t = timing[level];
    if (t.length === 0) continue;
    const mean = t.reduce((n, x) => n + x, 0) / t.length;
    lines.push(
      `| ${level} | ${t.length} | ${mean.toFixed(1)} | ${percentile(t, 95)} | ${Math.max(...t)} |`,
    );
  }
  console.log(lines.join('\n'));
});
