import { legalMoves, play, type GameState, type Move } from '@/engine';
import { chooseMove, referencePlayout, type CaptureGoConfig, type Rng } from '../index';

const games: [string, CaptureGoConfig][] = [
  [
    'G1',
    {
      size: 5,
      setup: { B: ['b3', 'c2', 'd3'], W: ['c3'] },
      first: 'B',
      rules: { n: 1, player: 'B', maxMoves: 50 },
      level: 1,
      blunder: 0.7,
    },
  ],
  [
    'G2',
    {
      size: 5,
      setup: { B: ['c3', 'd2'], W: ['d3', 'c2'] },
      first: 'B',
      rules: { n: 1, player: 'B', maxMoves: 50 },
      level: 1,
      blunder: 0.5,
    },
  ],
  [
    'G3',
    {
      size: 5,
      setup: { B: ['b3', 'c2'], W: ['c3', 'b2'] },
      first: 'B',
      rules: { n: 2, player: 'B', maxMoves: 50 },
      level: 1,
      blunder: 0.4,
    },
  ],
  [
    'G4',
    {
      size: 7,
      setup: { B: ['d4', 'e3'], W: ['e4', 'd3'] },
      first: 'B',
      rules: { n: 2, player: 'B', maxMoves: 98 },
      level: 1,
      blunder: 0.3,
    },
  ],
  [
    'G5',
    {
      size: 7,
      setup: { B: ['c4', 'd3'], W: ['d4', 'c3'] },
      first: 'B',
      rules: { n: 3, player: 'W', maxMoves: 98 },
      level: 1,
      blunder: 0.2,
    },
  ],
];
function noob(state: GameState, rng: Rng): Move {
  const moves = legalMoves(state);
  if (moves.length === 0) return { type: 'pass', color: state.toPlay };
  let best: Move | null = null;
  let most = 0;
  const r = rng();
  for (const p of moves) {
    const res = play(state, p);
    if (res.ok) {
      const n = res.facts.captured.flat().length;
      if (n > most) {
        most = n;
        best = { type: 'play', color: state.toPlay, point: p };
      }
    }
  }
  return best ?? { type: 'play', color: state.toPlay, point: moves[Math.floor(r * moves.length)] };
}
it('measure', () => {
  const blunders = (process.env.BL ?? '').split(',').filter(Boolean).map(Number);
  const out: string[] = [];
  games.forEach(([name, cfg], gi) => {
    const c = { ...cfg, blunder: blunders[gi] ?? cfg.blunder };
    for (const [who, learner] of [
      ['sensible', undefined],
      ['noob', noob],
    ] as const) {
      let wins = 0,
        plies = 0;
      for (let s = 1; s <= 200; s++) {
        const r = referencePlayout(c, s, learner);
        if (r.status === 'won') wins++;
        plies += r.plies;
      }
      out.push(`${name} b=${c.blunder} ${who}: ${wins / 2}% avg ${plies / 200}`);
    }
  });
  console.log(out.join('\n'));
  void chooseMove;
});
