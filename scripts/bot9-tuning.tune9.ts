// 9×9 bot tuning report (spec docs/specs/M6-bot-levels.md AC 7–9, §14).
//
// Plays seeds 1–N per pairing, each seed once with each colour (komi 5.5), ends every game by
// two passes, counts it with the dead stones of the bots' own proposal and prints win rates,
// game lengths and the time per move of each level (desktop Node, Date.now()).
//
//   npm run tune:bot9                                  # all pairings, seeds 1–100
//   TUNE_SEEDS=20 TUNE_PAIRS=L2-L1,L3-L2 npm run tune:bot9
//   TUNE_BLUNDER=0.6 npm run tune:bot9                 # level-1 (Easy) blunder to try
//
// Runs under Jest (for the `@/` paths and TS) with its own config: NOT part of `npm test`. It
// fails only on a hard error (AC 9: a throw, an illegal move, a game over 202 plies or one that
// does not end by two passes); the win rates are a report for the product owner.
import { createGame, pass, play, score, type Color, type GameState } from '@/engine';
import { botRng, chooseMove, proposeDead, type BotLevel } from '@/bot';
import { GAME_KOMI_9, L1_BLUNDER_9 } from '@/game9/config';

type PlayerId = 'L1' | 'L2' | 'L3' | 'Sensible';

const SEEDS = Number(process.env.TUNE_SEEDS ?? 100);
const BLUNDER = Number(process.env.TUNE_BLUNDER ?? L1_BLUNDER_9);

/** Spec AC 8 targets: A beats B at least this often. */
const PAIRS: { a: PlayerId; b: PlayerId; target: string; min: number; max?: number }[] = [
  { a: 'L2', b: 'L1', target: 'L2 beats L1 ≥ 80 %', min: 80 },
  { a: 'L3', b: 'L2', target: 'L3 beats L2 ≥ 65 %', min: 65 },
  { a: 'L3', b: 'L1', target: 'L3 beats L1 ≥ 90 %', min: 90 },
  { a: 'Sensible', b: 'L1', target: 'Sensible beats L1 ≥ 70 %', min: 70 },
  { a: 'Sensible', b: 'L3', target: 'Sensible loses to L3 ≥ 60 % (wins ≤ 40 %)', min: 0, max: 40 },
];

const selected = process.env.TUNE_PAIRS?.split(',');

/** A player: its bot level and blunder. Sensible = level 1, blunder 0, never fills own eyes. */
function settings(id: PlayerId): { level: BotLevel; blunder: number } {
  switch (id) {
    case 'L1':
      return { level: 1, blunder: BLUNDER };
    case 'Sensible':
      return { level: 1, blunder: 0 };
    case 'L2':
      return { level: 2, blunder: 0 };
    case 'L3':
      return { level: 3, blunder: 0 };
  }
}

const timing: Record<BotLevel, number[]> = { 1: [], 2: [], 3: [] };

interface GameResult {
  winner: Color | null;
  plies: number;
  margin: number;
}

function playGame(black: PlayerId, white: PlayerId, seed: number): GameResult {
  let state: GameState = createGame(9, { komi: GAME_KOMI_9 });
  while (!state.isOver) {
    const id = state.toPlay === 'B' ? black : white;
    const { level, blunder } = settings(id);
    const rngSeed = seed * 2 + (state.toPlay === 'B' ? 0 : 1);
    const started = Date.now();
    const { move } = chooseMove(state, {
      level,
      blunder,
      board9: true,
      rng: botRng(rngSeed, state.moves.length),
    });
    if (id !== 'Sensible') timing[level].push(Date.now() - started);
    const result = move.type === 'pass' ? pass(state) : play(state, move.point);
    if (!result.ok) throw new Error(`${id} played an illegal move: ${result.reason}`);
    state = result.state;
    if (state.moves.length > 202) throw new Error(`game over 202 plies (seed ${seed})`);
  }
  if (state.consecutivePasses !== 2) throw new Error('game did not end by two passes');
  const deadStones = proposeDead(state, botRng(seed, 0xdead));
  const counted = score(state.board, { komi: GAME_KOMI_9, deadStones });
  return { winner: counted.winner, plies: state.moves.length, margin: counted.margin };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

it('prints the 9×9 tuning report', () => {
  const lines: string[] = [
    `9×9 bot tuning — seeds 1–${SEEDS} × both colours, komi ${GAME_KOMI_9}, L1 blunder ${BLUNDER}`,
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
