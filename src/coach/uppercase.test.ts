// QA bug 3 (M6-beginner-friendly §14): coach notes name points like the board labels and the
// atari line — uppercase column letter ("D8"), never "d8".
import { parseVertex } from '@/engine';

import { factParams } from './facts';

it('factParams writes the point in uppercase', () => {
  expect(factParams({ kind: 'atari', color: 'W', point: parseVertex('d8', 9), size: 1 })).toEqual({
    count: 1,
    point: 'D8',
  });
});
