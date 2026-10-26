// 13×13 bot tuning report (spec docs/specs/M6b-13x13-bot-tuning.md §4.1–4.5, AC 1–7, 10, 22, 32).
//
// Plays seeded games on 13×13, ends every game by two passes, counts it with the dead stones of
// the bots' own proposal and prints win rates (with the §4.1 pass bands as OK / OUT), game
// lengths and the desktop time per move of each level, of the hint and of the dead-stone proposal.
//
//   npm run tune:bot13                                   # §4.1 rows + bot pairs + dead stones
//   TUNE_SEEDS=50 TUNE_PAIRS=Sensible-L3,Sensible-L3-H npm run tune:bot13
//   TUNE_PAIRS=L2-L1,L3-L2,L3-L1 npm run tune:bot13     # bot vs bot (AC 4)
//   TUNE_PAIRS=dead npm run tune:bot13                   # dead-stone accuracy (AC 22)
//   TUNE_HANDICAP=2-5 TUNE_LEVELS=1,2 npm run tune:bot13 # handicap table (AC 6–7)
//   TUNE_FIRST=51 TUNE_SEEDS=100 …                        # seeds 51–100 only (split long runs)
//   TUNE_BLUNDER / TUNE_SKIP_SAVE / TUNE_SKIP_ATARI / TUNE_SLIP / TUNE_TEMP / TUNE_PLAYOUTS
//                                                        # knobs to try (default: the _13 constants)
//
// Runs under Jest (for the `@/` paths and TS) with its own config: NOT part of `npm test`. It
// fails only on a hard error (a throw, an illegal move, a game over the ply cap, a game not ended
// by two passes); the win rates are a report for the product owner.
import {
  createGame,
  pass,
  play,
  score,
  toVertex,
  type Color,
  type GameState,
  type Vertex,
} from '@/engine';
import {
  MAX_PLIES_13,
  botRng,
  chooseMove,
  forcedCapture,
  judgeGroups,
  mcBudget,
  mcTemperature,
  proposeDead,
  type BotLevel,
  type GroupJudgement,
} from '@/bot';
import { hintFor } from '@/coach';
import {
  GAME_KOMI_13,
  L1_BLUNDER_13,
  L1_SKIP_ATARI_13,
  L1_SKIP_SAVE_13,
  L2_SLIP_13,
} from '@/game9/config';
import { HANDICAP_KOMI, STARTING_HANDICAP_13, handicapStones } from '@/game9/handicap';

type PlayerId = 'L1' | 'L2' | 'L3' | 'Sensible' | 'Noob';

const SIZE = 13;
const SEEDS = Number(process.env.TUNE_SEEDS ?? 100);
/** First seed (default 1): split a long run over processes, e.g. 1–50 and TUNE_FIRST=51. */
const FIRST = Number(process.env.TUNE_FIRST ?? 1);
const COUNT = SEEDS - FIRST + 1;
const BLUNDER = Number(process.env.TUNE_BLUNDER ?? L1_BLUNDER_13);
const SKIP_SAVE = Number(process.env.TUNE_SKIP_SAVE ?? L1_SKIP_SAVE_13);
const SKIP_ATARI = Number(process.env.TUNE_SKIP_ATARI ?? L1_SKIP_ATARI_13);
const SLIP = Number(process.env.TUNE_SLIP ?? L2_SLIP_13);
const TEMP = Number(process.env.TUNE_TEMP ?? mcTemperature(SIZE));
const PLAYOUTS = Number(process.env.TUNE_PLAYOUTS ?? mcBudget(SIZE).perCandidate);
const LEVELS = (process.env.TUNE_LEVELS ?? '1,2,3').split(',').map(Number) as BotLevel[];
/** "n" or "a-b": the handicap table only (AC 6–7). */
const HANDICAPS = parseRange(process.env.TUNE_HANDICAP);
const selected = process.env.TUNE_PAIRS?.split(',');
/** A game longer than this is a hard error: the bots pass from MAX_PLIES_13 on. */
const PLY_LIMIT = MAX_PLIES_13 + 2;

function parseRange(value: string | undefined): number[] {
  if (!value) return [];
  const [from, to] = value.split('-').map(Number);
  const out: number[] = [];
  for (let n = from; n <= (to ?? from); n++) out.push(n);
  return out;
}

/** Noob (M6-beginner-friendly AC 38): level-1 rules, blunder 0.25, skipSave 0.25. */
const NOOB = { level: 1 as BotLevel, blunder: 0.25, skipSave: 0.25, skipAtari: 0, slip: 0 };

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
const hintTiming: number[] = [];
const deadTiming: number[] = [];

interface GameResult {
  winner: Color | null;
  plies: number;
  final: GameState;
  komi: number;
}

function startOf(handicap: number): GameState {
  return handicap > 0
    ? createGame(SIZE, {
        komi: HANDICAP_KOMI,
        setup: { B: handicapStones(SIZE, handicap) },
        toPlay: 'W',
      })
    : createGame(SIZE, { komi: GAME_KOMI_13 });
}

function playGame(black: PlayerId, white: PlayerId, seed: number, handicap = 0): GameResult {
  let state = startOf(handicap);
  const komi = state.komi;
  while (!state.isOver) {
    const id = state.toPlay === 'B' ? black : white;
    const rngSeed = seed * 2 + (state.toPlay === 'B' ? 0 : 1);
    if (!isBot(id) && state.moves.length % 10 === 0) {
      const t0 = performance.now();
      hintFor(state);
      hintTiming.push(performance.now() - t0);
    }
    const started = performance.now();
    const { move } = chooseMove(state, {
      ...settings(id),
      boardN: true,
      rng: botRng(rngSeed, state.moves.length),
      playoutsPerCandidate: PLAYOUTS,
      temperature: TEMP,
    });
    if (isBot(id)) timing[settings(id).level].push(performance.now() - started);
    const result = move.type === 'pass' ? pass(state) : play(state, move.point);
    if (!result.ok) throw new Error(`${id} played an illegal move: ${result.reason}`);
    state = result.state;
    if (state.moves.length > PLY_LIMIT)
      throw new Error(`game over ${PLY_LIMIT} plies (seed ${seed})`);
  }
  if (state.consecutivePasses !== 2) throw new Error('game did not end by two passes');
  const t0 = performance.now();
  const deadStones = proposeDead(state, botRng(seed, 0xdead));
  deadTiming.push(performance.now() - t0);
  const counted = score(state.board, { komi, deadStones });
  return { winner: counted.winner, plies: state.moves.length, final: state, komi };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

const mean = (values: number[]) => values.reduce((n, x) => n + x, 0) / Math.max(1, values.length);
const pct = (n: number, of: number) => `${((100 * n) / of).toFixed(1)} %`;

const constants = () =>
  `L1 blunder ${BLUNDER}, skipSave ${SKIP_SAVE}, skipAtari ${SKIP_ATARI}; L2 slip ${SLIP}; ` +
  `L3 temp ${TEMP}, playouts/candidate ${PLAYOUTS}`;

interface Row {
  name: string;
  a: PlayerId;
  b: PlayerId;
  /** Start handicap of `b`'s level (A = Black, komi 0.5); 0 = even game, both colours. */
  handicap: number;
  band?: [number, number];
  /** The 9×9 number of the same row (AC 1: 13×13 must be lower). */
  below?: number;
  target: string;
}

/** §4.1 rows (Sensible = A) and AC 4 bot pairs. */
const ROWS: Row[] = [
  {
    name: 'Sensible-L1',
    a: 'Sensible',
    b: 'L1',
    handicap: 0,
    band: [70, 88],
    below: 92.5,
    target: '80 %',
  },
  {
    name: 'Sensible-L2',
    a: 'Sensible',
    b: 'L2',
    handicap: 0,
    band: [30, 50],
    below: 57,
    target: '40 %',
  },
  {
    name: 'Sensible-L3',
    a: 'Sensible',
    b: 'L3',
    handicap: 0,
    band: [5, 20],
    below: 24,
    target: '12 %',
  },
  {
    name: 'Sensible-L1-H',
    a: 'Sensible',
    b: 'L1',
    handicap: STARTING_HANDICAP_13[1],
    band: [75, 92],
    below: 97,
    target: '85 %',
  },
  {
    name: 'Sensible-L2-H',
    a: 'Sensible',
    b: 'L2',
    handicap: STARTING_HANDICAP_13[2],
    band: [50, 78],
    below: 83,
    target: '65 %',
  },
  {
    name: 'Sensible-L3-H',
    a: 'Sensible',
    b: 'L3',
    handicap: STARTING_HANDICAP_13[3],
    band: [20, 48],
    below: 56,
    target: '35 %',
  },
  { name: 'L2-L1', a: 'L2', b: 'L1', handicap: 0, band: [80, 100], target: 'L2 beats L1 ≥ 80 %' },
  { name: 'L3-L2', a: 'L3', b: 'L2', handicap: 0, band: [65, 100], target: 'L3 beats L2 ≥ 65 %' },
  { name: 'L3-L1', a: 'L3', b: 'L1', handicap: 0, band: [90, 100], target: 'L3 beats L1 ≥ 90 %' },
];

const levelOf = (id: PlayerId) => Number(id.slice(1)) as BotLevel;

function runRow(row: Row): string {
  let winsBlack = 0;
  let winsWhite = 0;
  const plies: number[] = [];
  let games = 0;
  for (let seed = FIRST; seed <= SEEDS; seed++) {
    if (row.handicap > 0) {
      const g = playGame(row.a, row.b, seed, row.handicap);
      if (g.winner === 'B') winsBlack++;
      plies.push(g.plies);
      games++;
      continue;
    }
    const asBlack = playGame(row.a, row.b, seed);
    const asWhite = playGame(row.b, row.a, seed);
    if (asBlack.winner === 'B') winsBlack++;
    if (asWhite.winner === 'W') winsWhite++;
    plies.push(asBlack.plies, asWhite.plies);
    games += 2;
  }
  const wins = winsBlack + winsWhite;
  const rate = (100 * wins) / games;
  const inBand = row.band ? rate >= row.band[0] && rate <= row.band[1] : true;
  const below = row.below === undefined || rate < row.below;
  const ok = inBand && below ? 'OK' : 'OUT';
  const level = levelOf(row.b);
  return (
    `| ${row.name} | ${row.handicap || 'even'} | ${games} | ${wins} (${rate.toFixed(1)} %) | ` +
    `${winsBlack}/${row.handicap > 0 ? games : games / 2} | ${row.handicap > 0 ? '–' : `${winsWhite}/${games / 2}`} | ` +
    `${mean(plies).toFixed(0)} / ${Math.max(...plies)} | ${row.target}` +
    `${row.band ? ` [${row.band[0]}–${row.band[1]}]` : ''}${row.below !== undefined ? ` < ${row.below}` : ''} | ` +
    `${ok} | L${level} |`
  );
}

/** AC 6–7: Sensible and Noob (Black, n stones, komi 0.5) against each level. */
function handicapReport(): string[] {
  const lines = [
    `13×13 handicap — seeds ${FIRST}–${SEEDS}, learner Black, White first, komi ${HANDICAP_KOMI}; ${constants()}`,
    '| Level | n | Sensible wins | Noob wins | Plies (mean / max) |',
    '|---|---|---|---|---|',
  ];
  for (const level of LEVELS) {
    const bot = `L${level}` as PlayerId;
    for (const n of HANDICAPS) {
      const wins: Record<string, number> = { Sensible: 0, Noob: 0 };
      const plies: number[] = [];
      for (const learner of ['Sensible', 'Noob'] as const) {
        for (let seed = FIRST; seed <= SEEDS; seed++) {
          const game = playGame(learner, bot, seed, n);
          if (game.winner === 'B') wins[learner]++;
          plies.push(game.plies);
        }
      }
      lines.push(
        `| L${level} | ${n} | ${pct(wins.Sensible, COUNT)} | ${pct(wins.Noob, COUNT)} | ` +
          `${mean(plies).toFixed(0)} / ${Math.max(...plies)} |`,
      );
    }
  }
  return lines;
}

const DEAD_GAMES = 30;
const PLANT_MIN_REGION = 15;

/** Empty regions bordered by one colour only: [owner, points]. */
function singleColourRegions(state: GameState): { owner: Color; points: number[] }[] {
  const { cells } = state.board;
  const seen = new Uint8Array(cells.length);
  const regions: { owner: Color; points: number[] }[] = [];
  for (let start = 0; start < cells.length; start++) {
    if (cells[start] !== null || seen[start]) continue;
    const points = [start];
    seen[start] = 1;
    const borders = new Set<Color>();
    for (let i = 0; i < points.length; i++) {
      const c = points[i];
      const x = c % SIZE;
      for (const n of [x > 0 ? c - 1 : -1, x < SIZE - 1 ? c + 1 : -1, c - SIZE, c + SIZE]) {
        if (n < 0 || n >= cells.length) continue;
        const stone = cells[n];
        if (stone !== null) borders.add(stone);
        else if (!seen[n]) {
          seen[n] = 1;
          points.push(n);
        }
      }
    }
    if (borders.size === 1) regions.push({ owner: [...borders][0], points });
  }
  return regions;
}

/**
 * AC 22: in the biggest single-colour region (≥ 15 points), the point farthest from every stone
 * (Manhattan distance; at least 2, so it touches no stone), or null.
 */
function plantPoint(state: GameState): { at: number; owner: Color } | null {
  const regions = singleColourRegions(state)
    .filter((r) => r.points.length >= PLANT_MIN_REGION)
    .sort((a, b) => b.points.length - a.points.length);
  const region = regions[0];
  if (!region) return null;
  const { cells } = state.board;
  let best = -1;
  let bestDistance = 1;
  for (const c of region.points) {
    let distance = Infinity;
    cells.forEach((stone, s) => {
      if (stone === null) return;
      const d =
        Math.abs((s % SIZE) - (c % SIZE)) + Math.abs(Math.floor(s / SIZE) - Math.floor(c / SIZE));
      distance = Math.min(distance, d);
    });
    if (distance > bestDistance) {
      best = c;
      bestDistance = distance;
    }
  }
  return best < 0 ? null : { at: best, owner: region.owner };
}

function withStone(state: GameState, at: number, stone: Color): GameState {
  const cells = [...state.board.cells];
  cells[at] = stone;
  return { ...state, board: { ...state.board, cells } };
}

/**
 * AC 22 check of one proposed-dead group: proved dead by `proposeDead` itself, or captured by force
 * here with a bigger reading budget (the group's opponent moves first). A group that neither proof
 * reaches is listed for a check by hand (a lone stone in a wide area needs more moves to read).
 */
function verifiedDead(final: GameState, group: GroupJudgement): boolean {
  if (group.status === 'proved-dead') return true;
  return forcedCapture(
    { ...final, isOver: false, consecutivePasses: 0, koPoint: null },
    {
      attacker: group.color === 'B' ? 'W' : 'B',
      target: group.at,
      maxMoves: 6,
      maxNodes: 20000,
    },
  ).forced;
}

/** AC 22 (PO 2026-10-25): 0 false kills in the final positions; planted lone stones ≥ 90 %. */
function deadReport(): string[] {
  const lines = [
    `13×13 dead-stone accuracy (AC 22) — seeds 1–${DEAD_GAMES} per pairing; ${constants()}`,
    '| Pairing | Games | Stones proposed dead | Groups not proved dead (check by hand) | Planted caught ≥ 90 % | OK |',
    '|---|---|---|---|---|---|',
  ];
  for (const [black, white] of [
    ['L2', 'L2'],
    ['Sensible', 'L2'],
  ] as [PlayerId, PlayerId][]) {
    let planted = 0;
    let caught = 0;
    let deadStones = 0;
    const unverified: string[] = [];
    for (let seed = 1; seed <= DEAD_GAMES; seed++) {
      const game = playGame(black, white, seed);
      const judgements = judgeGroups(game.final, botRng(seed, 0xdead));
      for (const group of judgements) {
        if (group.status !== 'dead' && group.status !== 'proved-dead') continue;
        deadStones += group.stones.length;
        if (!verifiedDead(game.final, group)) {
          unverified.push(`s${seed}:${group.at}(${group.stones.length})`);
        }
      }
      const plant = plantPoint(game.final);
      if (!plant) continue;
      planted++;
      const invader: Color = plant.owner === 'B' ? 'W' : 'B';
      const vertex: Vertex = toVertex({ x: plant.at % SIZE, y: Math.floor(plant.at / SIZE) }, SIZE);
      const withInvader = withStone(game.final, plant.at, invader);
      if (proposeDead(withInvader, botRng(seed, 0xdead)).includes(vertex)) caught++;
    }
    const ok = planted === 0 || caught / planted >= 0.9;
    lines.push(
      `| ${black} vs ${white} | ${DEAD_GAMES} | ${deadStones} | ${unverified.length}` +
        `${unverified.length ? ` (${unverified.join(' ')})` : ''} | ` +
        `${caught}/${planted} (${pct(caught, Math.max(1, planted))}) | ${ok ? 'OK' : 'OUT'} |`,
    );
  }
  return lines;
}

function timingReport(): string[] {
  const lines = ['', '| Timed | Count | Mean ms | p95 ms | Max ms |', '|---|---|---|---|---|'];
  const row = (name: string, t: number[]) =>
    `| ${name} | ${t.length} | ${mean(t).toFixed(1)} | ${percentile(t, 95).toFixed(1)} | ${Math.max(...t).toFixed(1)} |`;
  for (const level of [1, 2, 3] as BotLevel[]) {
    if (timing[level].length > 0) lines.push(row(`Level ${level}`, timing[level]));
  }
  if (hintTiming.length > 0) lines.push(row('Hint', hintTiming));
  if (deadTiming.length > 0) lines.push(row('Dead-stone proposal', deadTiming));
  return lines;
}

it('prints the 13×13 tuning report', () => {
  if (HANDICAPS.length > 0) {
    console.log([...handicapReport(), ...timingReport()].join('\n'));
    return;
  }
  const lines: string[] = [
    `13×13 bot tuning — seeds ${FIRST}–${SEEDS} (even: × both colours, komi ${GAME_KOMI_13}; handicap: A Black, komi ${HANDICAP_KOMI}); ${constants()}`,
    '| Row (A vs B) | Handicap | Games | A wins | A as Black | A as White | Plies (mean / max) | Target [band] < 9×9 | OK | Bot |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of ROWS) {
    if (selected && !selected.includes(row.name)) continue;
    if (row.a === 'Sensible' && !LEVELS.includes(levelOf(row.b))) continue;
    lines.push(runRow(row));
  }
  if (!selected || selected.includes('dead')) lines.push('', ...deadReport());
  console.log([...lines, ...timingReport()].join('\n'));
});
