// Spec docs/specs/M6b-13x13-game.md §4.2–4.6: the pure 13×13 game (komi, handicap, suggestions,
// route parameters, the reducer on size 13, count, take-back, danger labels).
import {
  createGame,
  groupAt,
  parseBoard,
  parseVertex,
  printBoard,
  score,
  type GameState,
} from '@/engine';

import { GAME_KOMI_13, GAME_KOMI_9, gameKomi } from './config';
import { countStones, territoryPoints } from './countView';
import { atariLine, dangerOf } from './danger';
import {
  STARTING_HANDICAP,
  STARTING_HANDICAP_13,
  handicapStones,
  suggestedHandicap,
} from './handicap';
import { parseConfirm, parseSize, playUrl } from './levelParam';
import { isSize13Unlocked } from './picker';
import { anyAtari, gameReducer, startSession, type GameEvent, type GameSession } from './session';

const rec = (wins: number, handicap?: number) => ({
  games: wins,
  wins,
  lossStreak: 0,
  ...(handicap === undefined ? {} : { handicap }),
});

function run(s: GameSession, ...events: GameEvent[]): GameSession {
  return events.reduce(gameReducer, s);
}

/** A 13×13 session whose board is `ascii`, with `moves` fake plies played (for Count now). */
function withBoard(ascii: string, plies = 6): GameSession {
  const s = startSession(2, 1, 0, true, 13);
  const { board } = parseBoard(ascii);
  const filler = { type: 'play' as const, color: 'B' as const, point: { x: 0, y: 0 } };
  const game: GameState = { ...s.game, board, moves: Array.from({ length: plies }, () => filler) };
  return { ...s, game };
}

describe('AC 7: komi', () => {
  it('even 13×13 games use komi 6.5; 9×9 keeps 5.5', () => {
    expect(GAME_KOMI_13).toBe(6.5);
    expect(GAME_KOMI_9).toBe(5.5);
    expect(gameKomi(13)).toBe(6.5);
    expect(gameKomi(9)).toBe(5.5);
  });

  it('an even 13×13 session: empty 13×13 board, Black first, komi 6.5', () => {
    const s = startSession(2, 1, 0, true, 13);
    expect(s.size).toBe(13);
    expect(s.game.board.size).toBe(13);
    expect(s.game.board.cells.every((c) => c === null)).toBe(true);
    expect(s.game.toPlay).toBe('B');
    expect(s.game.komi).toBe(6.5);
    expect(s.thinking).toBe(false);
  });

  it('a session without a size is 9×9 as before (AC 39)', () => {
    const s = startSession(2, 1);
    expect(s.size).toBe(9);
    expect(s.game.board.size).toBe(9);
    expect(s.game.komi).toBe(5.5);
  });
});

describe('AC 8, 10: 13×13 handicap stones', () => {
  it('n = 2…5 adds d4, k10, k4, d10, g7 in that order', () => {
    expect(handicapStones(13, 0)).toEqual([]);
    expect(handicapStones(13, 2)).toEqual(['d4', 'k10']);
    expect(handicapStones(13, 3)).toEqual(['d4', 'k10', 'k4']);
    expect(handicapStones(13, 4)).toEqual(['d4', 'k10', 'k4', 'd10']);
    expect(handicapStones(13, 5)).toEqual(['d4', 'k10', 'k4', 'd10', 'g7']);
  });

  it.each([1, 6, 9, -1, 2.5, NaN])('throws for n = %p', (n) => {
    expect(() => handicapStones(13, n)).toThrow();
  });

  it('9×9 is unchanged: c3, g7, g3, c7, e5', () => {
    expect(handicapStones(9, 5)).toEqual(['c3', 'g7', 'g3', 'c7', 'e5']);
  });

  it('n = 5 matches the §8 diagram; every stone is alone with 4 liberties', () => {
    const game = createGame(13, { setup: { B: handicapStones(13, 5) }, toPlay: 'W' });
    expect(printBoard(game.board)).toBe(
      [
        '. . . . . . . . . . . . .',
        '. . . . . . . . . . . . .',
        '. . . . . . . . . . . . .',
        '. . . X . . . . . X . . .',
        '. . . . . . . . . . . . .',
        '. . . . . . . . . . . . .',
        '. . . . . . X . . . . . .',
        '. . . . . . . . . . . . .',
        '. . . . . . . . . . . . .',
        '. . . X . . . . . X . . .',
        '. . . . . . . . . . . . .',
        '. . . . . . . . . . . . .',
        '. . . . . . . . . . . . .',
      ].join('\n'),
    );
    for (const v of handicapStones(13, 5)) {
      const group = groupAt(game.board, parseVertex(v, 13));
      expect(group?.stones).toHaveLength(1);
      expect(group?.liberties).toHaveLength(4);
    }
  });

  it.each([2, 3, 4, 5] as const)('a %i-stone 13×13 session: komi 0.5, White first', (n) => {
    const s = startSession(1, 1, n, true, 13);
    expect(s.game.komi).toBe(0.5);
    expect(s.game.toPlay).toBe('W');
    expect(s.thinking).toBe(true);
    const black = s.game.board.cells.filter((c) => c === 'B').length;
    expect(black).toBe(n);
  });
});

describe('AC 13–16: the 13×13 suggestion is its own table', () => {
  it('starts at Easy 2, Normal 4, Challenge 5; 9×9 keeps 2 / 5 / 5', () => {
    expect(STARTING_HANDICAP_13).toEqual({ 1: 2, 2: 4, 3: 5 });
    expect(STARTING_HANDICAP).toEqual({ 1: 2, 2: 5, 3: 5 });
    expect(suggestedHandicap({}, 1, 13)).toBe(2);
    expect(suggestedHandicap({}, 2, 13)).toBe(4);
    expect(suggestedHandicap({}, 3, 13)).toBe(5);
    expect(suggestedHandicap({}, 2)).toBe(5);
  });

  it('a stored 13×13 suggestion wins over the table', () => {
    expect(suggestedHandicap({ '2': rec(1, 3) }, 2, 13)).toBe(3);
    expect(suggestedHandicap({ '2': rec(1, 7) }, 2, 13)).toBe(4);
  });
});

describe('AC 2–3: 13×13 unlocks after any 9×9 win', () => {
  it('is locked with no 9×9 win, open after one', () => {
    expect(isSize13Unlocked({})).toBe(false);
    expect(isSize13Unlocked({ '1': { games: 3, wins: 0, lossStreak: 3 } })).toBe(false);
    expect(isSize13Unlocked({ '1': rec(1) })).toBe(true);
    expect(isSize13Unlocked({ '3': rec(2) })).toBe(true);
  });
});

describe('AC 5, 22: route parameters', () => {
  it('size: "13" plays 13×13; missing or invalid falls back to 9', () => {
    expect(parseSize('13')).toBe(13);
    for (const v of [undefined, '9', '19', '', 'abc', '13.0']) expect(parseSize(v)).toBe(9);
  });

  it('Start: 9×9 links are unchanged; 13×13 adds size (and confirm)', () => {
    expect(playUrl({ level: 2, handicap: 5, size: 9, confirm: true })).toBe(
      '/game/play?level=2&handicap=5',
    );
    expect(playUrl({ level: 3, handicap: 4, size: 13, confirm: false })).toBe(
      '/game/play?level=3&handicap=4&size=13',
    );
    expect(playUrl({ level: 1, handicap: 0, size: 13, confirm: true })).toBe(
      '/game/play?level=1&handicap=0&size=13&confirm=1',
    );
  });

  it('confirm: only "1" turns it on', () => {
    expect(parseConfirm('1')).toBe(true);
    for (const v of [undefined, '0', 'true', '']) expect(parseConfirm(v)).toBe(false);
  });
});

// Black owns a–f and g1–g12 (90 points), White owns h–n and g13 (79 points).
const SPLIT = `
  13 . . . . . X O O . . . . .
  12 . . . . . . X O . . . . .
  11 . . . . . . X O . . . . .
  10 . . . . . . X O . . . . .
   9 . . . . . . X O . . . . .
   8 . . . . . . X O . . . . .
   7 . . . . . . X O . . . . .
   6 . . . . . . X O . . . . .
   5 . . . . . . X O . . . . .
   4 . . . . . . X O . . . . .
   3 . . . . . . X O . . . . .
   2 . . . . . . X O . . . . .
   1 . . . . . . X O . . . . .
     a b c d e f g h j k l m n
`;

describe('AC 11: area scoring on 169 points with the session komi', () => {
  it('Black 90, White 79 + 6.5 = 85.5: Black wins by 4.5', () => {
    const s = withBoard(SPLIT);
    const counted = score(s.game.board, { komi: s.game.komi });
    expect(counted.black.total).toBe(90);
    expect(counted.white.total).toBe(85.5);
    expect(counted.black.total + counted.white.total - counted.white.komi).toBe(169);
    expect(counted.winner).toBe('B');
    expect(counted.margin).toBe(4.5);
  });

  it('Count now → mark → count → result on 13×13 gives the same numbers', () => {
    const s = run(
      withBoard(SPLIT),
      { type: 'countNow' },
      { type: 'markDone' },
      { type: 'countDone' },
    );
    expect(s.phase).toBe('result');
    expect(s.result).toMatchObject({ kind: 'count', winner: 'B', margin: 4.5 });
  });

  it('AC 12: a handicap game counts with komi 0.5', () => {
    const s = startSession(1, 1, 2, true, 13);
    const { board } = parseBoard(SPLIT);
    expect(score(board, { komi: s.game.komi }).margin).toBe(90 - 79 - 0.5);
  });
});

describe('AC 25: the reducer uses the 13×13 engine', () => {
  // The same lower-left stones on 9×9 and 13×13, Black to move:
  //   5 . . . X O X        White a2 + b1 still have liberties: Black a1 is suicide.
  //   4 . . . . X .        White e5 has one liberty (e6): Black e6 captures it.
  //   2 O . . . . .
  //   1 . O . . . .
  //     a b c d e f
  const corner = (size: 9 | 13) => {
    const rows = Array.from({ length: size }, () => Array<string>(size).fill('.'));
    const put = (v: string, c: string) => {
      const p = parseVertex(v, size);
      rows[size - 1 - p.y][p.x] = c;
    };
    for (const v of ['a2', 'b1', 'e5']) put(v, 'O');
    for (const v of ['d5', 'f5', 'e4']) put(v, 'X');
    return rows.map((r) => r.join(' ')).join('\n');
  };

  function session(size: 9 | 13): GameSession {
    const s = startSession(2, 1, 0, true, size);
    const { board } = parseBoard(corner(size));
    return { ...s, game: { ...s.game, board } };
  }

  it.each([9, 13] as const)('%i×%i: occupied, suicide, capture', (size) => {
    const s = session(size);
    expect(run(s, { type: 'play', point: parseVertex('a2', size) }).note?.key).toBe(
      'game.fb.illegal.occupied',
    );
    expect(run(s, { type: 'play', point: parseVertex('a1', size) }).note?.key).toBe(
      'game.fb.illegal.suicide',
    );
    // e6 captures White e5.
    const captured = run(s, { type: 'play', point: parseVertex('e6', size) });
    expect(captured.last?.captured).toEqual([parseVertex('e5', size)]);
    expect(captured.thinking).toBe(true);
  });

  it('13×13: the bot answers with a legal 13×13 move or pass', () => {
    const s = run(startSession(2, 3, 0, true, 13), { type: 'play', point: parseVertex('k10', 13) });
    const after = run(s, { type: 'bot' });
    expect(after.thinking).toBe(false);
    expect(after.game.moves).toHaveLength(2);
  });
});

describe('AC 32: take-back on 13×13 with a handicap', () => {
  it('removes the bot reply and the learner move', () => {
    let s = startSession(1, 4, 2, true, 13);
    s = run(s, { type: 'bot' });
    const before = s.game;
    s = run(s, { type: 'play', point: parseVertex('k4', 13) }, { type: 'bot' });
    expect(s.game.moves).toHaveLength(3);
    s = run(s, { type: 'takeback' });
    expect(s.game).toBe(before);
  });
});

describe('AC 30: Resign works while the bot thinks', () => {
  it('ends the game; the late bot answer is ignored', () => {
    let s = run(startSession(3, 1, 0, true, 13), { type: 'play', point: parseVertex('g7', 13) });
    expect(s.thinking).toBe(true);
    s = run(s, { type: 'resign' });
    expect(s.phase).toBe('result');
    expect(s.thinking).toBe(false);
    expect(run(s, { type: 'bot' })).toBe(s);
  });
});

describe('AC 34, 36: labels, marks and the count view on 13×13', () => {
  const ATARI = `
    13 . . . . . . . . . . . . .
    12 . . . . . . . . . . . . .
    11 . . . . . . . . . X . . .
    10 . . . . . . . . X O X . .
     9 . . . . . . . . . . . . .
     8 . . . . . . . . . . . . .
     7 . . . . . . . . . . . . .
     6 . . . . . . . . . . . . .
     5 . . . . . . . . . . . . .
     4 . . . . . . . . . . . . .
     3 . . . . . . . . . . . . .
     2 . . . . . . . . . . . . .
     1 . . . . . . . . . . . . .
       a b c d e f g h j k l m n
  `;

  it('the atari line names K10 and its liberty K9 (no "I")', () => {
    const s = withBoard(ATARI);
    const danger = dangerOf(s.game, 'B');
    expect(anyAtari(s.game)).toBe(true);
    expect(atariLine(danger, 'B', 13)?.note).toEqual({
      key: 'game9.atari.bot.one',
      params: { where: 'K10', lib: 'K9' },
    });
  });

  it('marking toggles a 13×13 group; the count view drops it', () => {
    let s = run(withBoard(ATARI), { type: 'countNow' });
    expect(s.phase).toBe('mark');
    s = run(s, { type: 'mark', at: 'k10' });
    expect(s.marks).toEqual(['k10']);
    const cells = countStones(s.game.board.cells, s.marks);
    expect(cells[parseVertex('k10', 13).y * 13 + parseVertex('k10', 13).x]).toBeNull();
    const counted = score(s.game.board, { komi: 6.5, deadStones: s.marks });
    const land = territoryPoints(counted, s.game.board.cells, s.marks);
    expect(land.B.length + land.W.length).toBeGreaterThan(0);
  });
});
