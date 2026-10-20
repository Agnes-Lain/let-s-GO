// Test-only life-and-death search (spec M5-life-death AC 10–13): an exhaustive, bounded
// minimax over every legal move and a pass, with the real engine. Slow by design; small boards only.
import { groupAt, legalMoves, parseVertex, play, type GameState, type Vertex } from '@/engine';

/** `state` with the other side to move (a pass that never ends the game, no ko ban carried). */
function passed(state: GameState): GameState {
  return { ...state, toPlay: state.toPlay === 'B' ? 'W' : 'B', koPoint: null };
}

function key(state: GameState, plies: number): string {
  const cells = state.board.cells.map((c) => c ?? '.').join('');
  const ko = state.koPoint ? `${state.koPoint.x},${state.koPoint.y}` : '-';
  return `${cells}|${state.toPlay}|${ko}|${plies}`;
}

/**
 * Whether the side to move in `state` (the attacker) can force the capture of the stone on
 * `target` within `plies` plies (attacker and defender moves both count). The defender may play
 * any legal point or pass; so may the attacker.
 */
export function canForceCapture(state: GameState, target: Vertex, plies: number): boolean {
  const size = state.board.size;
  const p = parseVertex(target, size);
  const defender = state.board.cells[p.y * size + p.x];
  if (defender === null) throw new Error(`no stone on ${target}`);
  if (state.toPlay === defender) throw new Error('the attacker must be to move');
  const memo = new Map<string, boolean>();

  const gone = (s: GameState) => s.board.cells[p.y * size + p.x] !== defender;

  // Attacker to move: some move captures now, or leads to a forced capture.
  const attack = (s: GameState, left: number): boolean => {
    if (left <= 0) return false;
    const k = key(s, left);
    const cached = memo.get(k);
    if (cached !== undefined) return cached;
    let won = false;
    for (const move of legalMoves(s)) {
      const r = play(s, move);
      if (!r.ok) continue;
      if (gone(r.state) || defend(r.state, left - 1)) {
        won = true;
        break;
      }
    }
    if (!won && left >= 3) won = defend(passed(s), left - 1);
    memo.set(k, won);
    return won;
  };

  // Defender to move: true when every reply (and a pass) still loses the target in time.
  const defend = (s: GameState, left: number): boolean => {
    if (left <= 1) return false; // the attacker needs at least one more move
    const k = key(s, left);
    const cached = memo.get(k);
    if (cached !== undefined) return cached;
    let lost = attack(passed(s), left - 1);
    if (lost) {
      for (const move of legalMoves(s)) {
        const r = play(s, move);
        if (!r.ok) continue;
        if (!attack(r.state, left - 1)) {
          lost = false;
          break;
        }
      }
    }
    memo.set(k, lost);
    return lost;
  };

  return attack(state, plies);
}

/** The defender's liberty count of the group on `at` (0 when the point is empty). */
export function libertyCount(state: GameState, at: Vertex): number {
  return groupAt(state.board, at)?.liberties.length ?? 0;
}
