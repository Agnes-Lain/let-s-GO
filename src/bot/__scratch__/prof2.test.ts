import { createGame, legalMoves, play } from '@/engine';
import { exposedStones } from '../heuristic';
import { referencePlayout } from '../index';
it('prof2', () => {
  const cfg = {
    size: 9 as const,
    setup: { B: ['e5', 'f4'], W: ['f5', 'e4'] },
    first: 'B' as const,
    rules: { n: 9, player: 'B' as const, maxMoves: 30 },
    level: 1 as const,
    blunder: 0.5,
  };
  const st = referencePlayout(cfg, 1).state;
  let t0 = Date.now();
  for (let i = 0; i < 100; i++) legalMoves(st);
  console.log('legal x100', Date.now() - t0);
  const pts = legalMoves(st);
  t0 = Date.now();
  const res: any[] = [];
  for (let i = 0; i < 100; i++) for (const p of pts) res.push(play(st, p));
  console.log('play x100', Date.now() - t0, pts.length);
  t0 = Date.now();
  for (let i = 0; i < 100; i++)
    for (const r of res.slice(0, pts.length)) exposedStones(r.state.board, 'B');
  console.log('exposed x100', Date.now() - t0);
  void createGame;
});
