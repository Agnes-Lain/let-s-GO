// Bot tuning report (spec docs/specs/M4-bot-capture-go.md AC 64–65, §6.5).
//
// Plays every Unit 6 game from its real lesson JSON (start position, `bot.blunder`, rules) for
// seeds 1–200 with two reference learners and prints a table of win rates and game lengths:
//   - Sensible = bot level 1 with blunder 0 for the learner's colour (the validator's learner);
//   - Noob     = captures when it can (largest capture), otherwise a uniformly random legal move.
//
//   npm run tune:bot                                   # values from the lesson JSON
//   TUNE_BLUNDER=0.7,0.75,0.7,0.75,0.75 npm run tune:bot   # try other blunders (G1..G5)
//
// Runs under Jest (for the `@/` paths and TS), but with its own config: it is NOT part of
// `npm test`. It fails only on a hard error (AC 65: a throw or a game over `maxMoves`); the win
// rates are a report for the product owner, who approves the final blunder values.

import { legalMoves, play, type Color, type GameState, type Move } from '@/engine';
import { referencePlayout, type CaptureGoConfig, type Rng } from '@/bot';
import type { Lesson, PlayBotExercise } from '@/lessons/schema';
import u06CaptureGo from '@/lessons/content/u06-capture-go.json';
import u06Checkpoint from '@/lessons/content/u06-checkpoint.json';

const SEEDS = 200;

/** Spec §6.5 targets, in game order (min/max in %, plies as the estimated range). */
const TARGETS = [
  { sensible: [95, 100], noob: [70, 100], plies: [2, 6] },
  { sensible: [80, 100], noob: [40, 70], plies: [8, 16] },
  { sensible: [75, 100], noob: [30, 60], plies: [12, 24] },
  { sensible: [70, 90], noob: [20, 50], plies: [16, 34] },
  { sensible: [60, 85], noob: [10, 40], plies: [24, 50] },
] as const;

/** Captures the most stones it can; otherwise a uniformly random legal move. */
function noob(state: GameState, rng: Rng): Move {
  const moves = legalMoves(state);
  if (moves.length === 0) return { type: 'pass', color: state.toPlay };
  const r = rng();
  let best: Move | null = null;
  let most = 0;
  for (const point of moves) {
    const result = play(state, point);
    if (!result.ok) continue;
    const captured = result.facts.captured.flat().length;
    if (captured > most) {
      most = captured;
      best = { type: 'play', color: state.toPlay, point };
    }
  }
  return best ?? { type: 'play', color: state.toPlay, point: moves[Math.floor(r * moves.length)] };
}

function configOf(ex: PlayBotExercise, blunder: number): CaptureGoConfig {
  const first: Color = ex.first ?? 'B';
  return {
    size: ex.size,
    setup: ex.setup,
    first,
    rules: {
      n: ex.win.n,
      player: ex.player ?? 'B',
      maxMoves: ex.maxMoves ?? 2 * ex.size * ex.size,
    },
    level: ex.bot.level,
    blunder,
  };
}

interface Measured {
  winPct: number;
  avgPlies: number;
  maxPlies: number;
}

function measure(config: CaptureGoConfig, learner?: (s: GameState, r: Rng) => Move): Measured {
  let wins = 0;
  let plies = 0;
  let maxPlies = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const result = referencePlayout(config, seed, learner);
    if (result.plies > config.rules.maxMoves) {
      throw new Error(`seed ${seed}: ${result.plies} plies > maxMoves ${config.rules.maxMoves}`);
    }
    if (result.status === 'won') wins++;
    plies += result.plies;
    maxPlies = Math.max(maxPlies, result.plies);
  }
  return { winPct: (100 * wins) / SEEDS, avgPlies: plies / SEEDS, maxPlies };
}

const mark = (value: number, [min, max]: readonly [number, number]) =>
  value >= min && value <= max ? 'ok' : value < min ? 'LOW' : 'HIGH';

it('prints the Unit 6 bot tuning table (AC 64–65)', () => {
  const overrides = (process.env.TUNE_BLUNDER ?? '').split(',').filter(Boolean).map(Number);
  const games = [u06CaptureGo, u06Checkpoint].flatMap(
    (lesson) => (lesson as unknown as Lesson).exercises as PlayBotExercise[],
  );
  const rows = [
    '| Game | blunder | Sensible wins (target) | Noob wins (target) | Avg plies S / N (estimate) | Max plies |',
    '|---|---|---|---|---|---|',
  ];
  games.forEach((ex, i) => {
    const target = TARGETS[i];
    const blunder = overrides[i] ?? ex.bot.blunder ?? 0;
    const config = configOf(ex, blunder);
    const s = measure(config);
    const n = measure(config, noob);
    const plyRange = [target.plies[0] * 0.7, target.plies[1] * 1.3] as const;
    rows.push(
      `| G${i + 1} \`${ex.id}\` | ${blunder} ` +
        `| ${s.winPct}% (${target.sensible.join('–')}%) ${mark(s.winPct, target.sensible)} ` +
        `| ${n.winPct}% (${target.noob.join('–')}%) ${mark(n.winPct, target.noob)} ` +
        `| ${s.avgPlies.toFixed(1)} / ${n.avgPlies.toFixed(1)} (${target.plies.join('–')}) ` +
        `${mark(s.avgPlies, plyRange)} / ${mark(n.avgPlies, plyRange)} ` +
        `| ${Math.max(s.maxPlies, n.maxPlies)} / ${config.rules.maxMoves} |`,
    );
  });
  process.stdout.write(`\n${rows.join('\n')}\n\n`);
});
