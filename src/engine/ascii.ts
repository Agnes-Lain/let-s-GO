// ASCII boards for tests, debugging and lesson authoring (spec §3 "ASCII board format").
//
//   5 . . . . .     one row per line, top row (highest number) first
//   4 . . X . .     '.' empty  'X' black  'O' white
//   3 . X O * .     '*' empty point of interest       -> `points`
//   2 . x . . .     'x' / 'o' marked black/white stone -> stone + `marked`
//   1 . . . . .     optional row numbers on the left, optional letter line at the bottom
//     a b c d e

import { emptyBoard, indexOf, stoneAt } from './board';
import { columnLetter, comparePoints, isBoardSize, toPoint } from './coordinates';
import { EngineError, type Board, type BoardSize, type Color, type Point } from './types';

const ROW_PATTERN = /^(\d+)?\s*([.XOxo*\s]*)$/;
const STONE_FOR_CHAR: Record<string, Color | null> = {
  '.': null,
  '*': null,
  X: 'B',
  x: 'B',
  O: 'W',
  o: 'W',
};

export function parseBoard(ascii: string): { board: Board; marked: Point[]; points: Point[] } {
  const lines = ascii
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const letterLine = lines.length > 0 && lines[lines.length - 1].startsWith('a') ? lines.pop() : '';
  const rows = lines.map(parseRow);
  const size = rows.length;

  if (!isBoardSize(size)) {
    return invalid(`expected 5, 7, 9, 13 or 19 rows, got ${size}`);
  }
  if (rows.some((row) => row.cells.length !== size)) {
    return invalid(`every row must have ${size} cells (the board must be square)`);
  }
  const numbered = rows.filter((row) => row.number !== null).length;
  if (numbered !== 0 && numbered !== size) {
    return invalid('row numbers must be on every row or on none');
  }
  rows.forEach((row, i) => {
    if (row.number !== null && row.number !== size - i) {
      invalid(`row ${i + 1} from the top must be numbered ${size - i}, got ${row.number}`);
    }
  });
  if (letterLine && letterLine.replace(/\s+/g, '') !== columnLetters(size).join('')) {
    invalid(`the letter line must be "${columnLetters(size).join(' ')}"`);
  }

  const cells: (Color | null)[] = [...emptyBoard(size).cells];
  const marked: Point[] = [];
  const points: Point[] = [];
  rows.forEach((row, i) => {
    const y = size - 1 - i;
    row.cells.forEach((char, x) => {
      cells[indexOf({ x, y }, size)] = STONE_FOR_CHAR[char];
      if (char === 'x' || char === 'o') marked.push({ x, y });
      if (char === '*') points.push({ x, y });
    });
  });

  return {
    board: { size, cells },
    marked: marked.sort(comparePoints),
    points: points.sort(comparePoints),
  };
}

export function printBoard(
  board: Board,
  opts: { coords?: boolean; marked?: Point[]; points?: Point[] } = {},
): string {
  const { size } = board;
  const chars: string[] = board.cells.map((stone) =>
    stone === 'B' ? 'X' : stone === 'W' ? 'O' : '.',
  );

  for (const at of opts.marked ?? []) {
    const point = toPoint(at, size);
    const stone = stoneAt(board, point);
    if (stone === null) invalid(`marked point ${JSON.stringify(at)} has no stone`);
    chars[indexOf(point, size)] = stone === 'B' ? 'x' : 'o';
  }
  for (const at of opts.points ?? []) {
    const point = toPoint(at, size);
    if (stoneAt(board, point) !== null) invalid(`point ${JSON.stringify(at)} is not empty`);
    chars[indexOf(point, size)] = '*';
  }

  const labelWidth = String(size).length;
  const lines: string[] = [];
  for (let y = size - 1; y >= 0; y--) {
    const row = chars.slice(indexOf({ x: 0, y }, size), indexOf({ x: 0, y: y + 1 }, size));
    const label = opts.coords ? String(y + 1).padStart(labelWidth) + ' ' : '';
    lines.push(label + row.join(' '));
  }
  if (opts.coords) {
    lines.push(' '.repeat(labelWidth + 1) + columnLetters(size).join(' '));
  }
  return lines.join('\n');
}

function parseRow(line: string): { number: number | null; cells: string[] } {
  const match = ROW_PATTERN.exec(line);
  if (!match) {
    return invalid(`unexpected character in row "${line}"`);
  }
  return {
    number: match[1] === undefined ? null : Number(match[1]),
    cells: match[2].replace(/\s+/g, '').split(''),
  };
}

function columnLetters(size: BoardSize): string[] {
  return Array.from({ length: size }, (_, x) => columnLetter(x));
}

function invalid(reason: string): never {
  throw new EngineError('invalid-ascii', `Invalid ASCII board: ${reason}`);
}
