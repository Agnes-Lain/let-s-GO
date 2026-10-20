// QA: independent full-width check of the accepted/rejected sets of the three shipped search
// exercises. The defender may play ANY legal move or pass (more than the §3.3 model); the
// attacker may play ANY legal move. Slow-but-sound oracle for the engine (spec §3.2, AC 27).
import {
  groupAt,
  legalMoves,
  pass,
  play,
  parseVertex,
  type BoardSize,
  type GameState,
  type Point,
} from '@/engine';
import {
  advance,
  judgeSequence,
  learnerMoveCount,
  sequenceStart,
  type SequenceProgress,
} from '@/exercises/sequence';
import { LESSON_FILES } from '@/lessons/registry';
import type { Lesson, SequenceExercise } from '@/lessons';

const lessons = LESSON_FILES as readonly Lesson[];
const get = (l: string, id: string) =>
  lessons.find((x) => x.id === l)!.exercises.find((e) => e.id === id) as SequenceExercise;
const EXS: [SequenceExercise, string[]][] = [
  [get('u09-ladder', 'ladder-play'), ['c4']],
  [get('u09-ladder', 'ladder-play-corner'), ['e6']],
  [get('u09-review', 'r-ladder-play'), ['c2']],
];

function oracle(target: Point, fullAttacker: boolean) {
  const memo = new Map<string, boolean>();
  const key = (s: GameState, r: number, a: boolean) =>
    s.board.cells.map((c) => c ?? '.').join('') +
    s.toPlay +
    (s.koPoint ? s.koPoint.x + ',' + s.koPoint.y : '') +
    r +
    a;
  // attacker to move, r moves left: can capture against every defence (defender: any move or pass)
  const atk = (s: GameState, r: number): boolean => {
    const g = groupAt(s.board, target);
    if (!g) return true;
    if (r === 0 || g.liberties.length > r) return false;
    const k = key(s, r, true);
    if (memo.has(k)) return memo.get(k)!;
    const pts = fullAttacker ? legalMoves(s) : g.liberties;
    let win = false;
    for (const p of pts) {
      const res = play(s, p);
      if (res.ok && def(res.state, r - 1)) {
        win = true;
        break;
      }
    }
    memo.set(k, win);
    return win;
  };
  const def = (s: GameState, r: number): boolean => {
    if (!groupAt(s.board, target)) return true;
    if (r === 0) return false;
    const k = key(s, r, false);
    if (memo.has(k)) return memo.get(k)!;
    let all = true;
    const ps = pass(s);
    if (ps.ok && !atk(ps.state, r)) all = false;
    if (all)
      for (const p of legalMoves(s)) {
        const res = play(s, p);
        if (res.ok && !atk(res.state, r)) {
          all = false;
          break;
        }
      }
    memo.set(k, all);
    return all;
  };
  return { atk, def };
}

describe('brute-force oracle vs the judge (defender: any move or pass)', () => {
  it.each(EXS.map(([e]) => [e.id, e]))(
    '%s: judge accepts exactly the oracle-winning moves',
    (_id, ex) => {
      const e = ex as SequenceExercise;
      const target = parseVertex((e.goal as { target: string }).target, e.size as BoardSize);
      const walk = (p: SequenceProgress, depth: number) => {
        const r = learnerMoveCount(e) - p.ply / 2;
        const o = oracle(target, false);
        for (const pt of legalMoves(p.state)) {
          const res = play(p.state, pt);
          if (!res.ok) continue;
          const win = !groupAt(res.state.board, target) || o.def(res.state, r - 1);
          const j = judgeSequence(e, p, pt);
          const acc = j.kind === 'next' || j.kind === 'solved';
          expect({ at: `${pt.x},${pt.y}`, ply: p.ply, acc }).toEqual({
            at: `${pt.x},${pt.y}`,
            ply: p.ply,
            acc: win,
          });
          if (acc && j.kind === 'next' && depth < 3) walk(advance(p, j), depth + 1);
        }
      };
      walk(sequenceStart(e), 0);
    },
    120000,
  );
});
