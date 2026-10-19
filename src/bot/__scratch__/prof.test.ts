import { referencePlayout } from '../index';
it('prof', () => {
  const cfg = {
    size: 9 as const,
    setup: { B: ['e5', 'f4'], W: ['f5', 'e4'] },
    first: 'B' as const,
    rules: { n: 9, player: 'B' as const, maxMoves: 162 },
    level: 1 as const,
    blunder: 0.5,
  };
  let plies = 0;
  const t0 = Date.now();
  for (let s = 1; s <= 10; s++) plies += referencePlayout(cfg, s).plies;
  console.log('ms', Date.now() - t0, 'plies', plies);
});
