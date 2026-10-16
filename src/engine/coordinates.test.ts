import { EngineError, parseVertex, toVertex, type BoardSize } from './index';

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof EngineError ? error.code : 'not-an-engine-error';
  }
  return undefined;
}

describe('coordinates', () => {
  it('AC 2: parses vertices on 9x9 (columns from the left, rows from the bottom, no i)', () => {
    expect(parseVertex('a1', 9)).toEqual({ x: 0, y: 0 });
    expect(parseVertex('j9', 9)).toEqual({ x: 8, y: 8 });
    expect(parseVertex('h1', 9)).toEqual({ x: 7, y: 0 });
    expect(parseVertex('j1', 9)).toEqual({ x: 8, y: 0 });
    expect(parseVertex('C3', 9)).toEqual({ x: 2, y: 2 });
  });

  it('AC 2: writes vertices in lowercase', () => {
    expect(toVertex({ x: 8, y: 8 }, 9)).toBe('j9');
    expect(toVertex({ x: 0, y: 0 }, 9)).toBe('a1');
    expect(toVertex({ x: 7, y: 0 }, 9)).toBe('h1');
  });

  it('AC 2: parses t19 on 19x19', () => {
    expect(parseVertex('t19', 19)).toEqual({ x: 18, y: 18 });
    expect(toVertex({ x: 18, y: 18 }, 19)).toBe('t19');
  });

  it('AC 2: toVertex and parseVertex round-trip on every point of every size', () => {
    const sizes: BoardSize[] = [5, 7, 9, 13, 19];
    for (const size of sizes) {
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          expect(parseVertex(toVertex({ x, y }, size), size)).toEqual({ x, y });
        }
      }
    }
  });

  it.each(['i3', 'k1', 'a10', 'a0', '', '3c'])('AC 3: %j is invalid on 9x9', (vertex) => {
    expect(errorCode(() => parseVertex(vertex, 9))).toBe('invalid-vertex');
  });

  it.each(['f1', 'c6'])('AC 3: %j is invalid on 5x5', (vertex) => {
    expect(errorCode(() => parseVertex(vertex, 5))).toBe('invalid-vertex');
  });

  it('AC 3: rejects other malformed vertices', () => {
    for (const vertex of ['a01', ' a1', 'a1 ', 'aa1', 'a', '1', 'u1', 'a-1']) {
      expect(errorCode(() => parseVertex(vertex, 19))).toBe('invalid-vertex');
    }
  });

  it('AC 3: toVertex rejects points off the board', () => {
    expect(errorCode(() => toVertex({ x: 5, y: 0 }, 5))).toBe('invalid-vertex');
    expect(errorCode(() => toVertex({ x: 0, y: -1 }, 5))).toBe('invalid-vertex');
    expect(errorCode(() => toVertex({ x: 1.5, y: 0 }, 5))).toBe('invalid-vertex');
  });
});
