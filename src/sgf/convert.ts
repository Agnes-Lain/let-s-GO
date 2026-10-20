// SGF tree -> tsumego problem (spec docs/specs/M5-sgf-import.md §4, AC 10–18). Pure TS.
//
// Convention (SGF has no "right/wrong" flag):
//   - the FIRST child at each node is the correct line;
//   - extra variations where the first move is chosen are WRONG answers (the learner's mistake,
//     then optional scripted replies);
//   - a variation anywhere deeper is SGF_NESTED_VARIATION.
// `C` comments are author notes: parsed, never converted. Legality is checked later by the
// lesson validator with the engine (SEQ_ILLEGAL_MOVE); this module only reads the file.

import type { Color } from '@/engine';
import type { LessonSize, MoveDef } from '@/lessons/schema';

import { sgfPoint, sgfPoints } from './points';
import type {
  ConvertOptions,
  ConvertResult,
  SgfIssue,
  SgfNode,
  SgfPosition,
  SgfProperty,
} from './types';

export { sgfPoint } from './points';

const SIZES: readonly LessonSize[] = [5, 7, 9];
const COLUMN_LETTERS = 'abcdefghjklmnopqrst';

/** Metadata and author notes: ignored without a warning. */
const IGNORED = new Set(
  (
    'FF CA AP GN GC ST DT PW PB PC EV RO RE TE HA KM RU SO US AN BR WR BT WT CP ON OT TM ' +
    'C N BL WL OB OW'
  ).split(' '),
);
/** Properties that would change the position: errors anywhere. */
const FORBIDDEN: Record<string, string> = {
  AE: 'AE (remove stones) is not supported: draw the start position with AB/AW only',
  KO: 'KO (play an illegal move) is not supported',
};
const SETUP = new Set(['AB', 'AW', 'PL']);

class Issues {
  readonly errors: SgfIssue[] = [];
  readonly warnings: SgfIssue[] = [];
  constructor(readonly file?: string) {}

  private make(code: string, at: SgfPosition, message: string): SgfIssue {
    const issue: SgfIssue = { code, message, line: at.line, col: at.col };
    if (this.file !== undefined) issue.file = this.file;
    return issue;
  }
  error(code: string, at: SgfPosition, message: string): void {
    this.errors.push(this.make(code, at, message));
  }
  warn(code: string, at: SgfPosition, message: string): void {
    this.warnings.push(this.make(code, at, message));
  }
}

function prop(node: SgfNode, id: string): SgfProperty | undefined {
  return node.props.find((p) => p.id === id);
}

/** Engine vertex -> sort key (column, then row from the bottom), like the engine's lists. */
function vertexOrder(a: string, b: string): number {
  const ax = COLUMN_LETTERS.indexOf(a[0]);
  const bx = COLUMN_LETTERS.indexOf(b[0]);
  return ax - bx || Number(a.slice(1)) - Number(b.slice(1));
}

export function convertSgf(tree: SgfNode, opts: ConvertOptions = {}): ConvertResult {
  const issues = new Issues(opts.file);
  const fail = (): ConvertResult => ({ ok: false, errors: issues.errors });

  const gm = prop(tree, 'GM');
  if (gm && gm.values[0].text.trim() !== '1') {
    issues.error('SGF_BAD_GAME', gm.values[0], `GM[${gm.values[0].text}] is not Go (use GM[1])`);
    return fail();
  }
  const size = boardSize(tree, issues);
  if (size === null) return fail();

  checkProperties(tree, issues, true);
  const setup = readSetup(tree, size, issues);

  const plProp = prop(tree, 'PL');
  let pl: Color | null = null;
  if (plProp) {
    const value = plProp.values[0].text.trim().toUpperCase();
    if (value === 'B' || value === 'W') pl = value;
    else issues.error('SGF_BAD_PLAYER', plProp.values[0], `PL[${value}] must be PL[B] or PL[W]`);
  }

  // Follow the main line until the first move or the node where the first move branches.
  let branchPoint: SgfNode | null = null;
  let first: SgfNode | null = tree;
  while (first && !hasMove(first)) {
    if (first !== tree) checkProperties(first, issues, false);
    if (first.children.length > 1) {
      branchPoint = first;
      first = null;
      break;
    }
    first = first.children[0] ?? null;
  }
  const branches = branchPoint ? branchPoint.children : first ? [first] : [];
  const lines = branches.map((start) => {
    const before = issues.errors.length;
    return { ...readLine(start, tree, size, issues), clean: issues.errors.length === before };
  });

  const main = lines[0];
  if (!main || main.moves.length === 0) {
    if (!main || main.clean) {
      issues.error(
        'SGF_NO_MOVES',
        branches[0] ?? tree,
        'the problem has no moves (add B[..] or W[..])',
      );
    }
    return fail();
  }
  const toPlay = pl ?? main.moves[0].color;
  const firstMoves = new Set<string>();
  lines.forEach((line, i) => {
    const node = branches[i];
    const move = line.moves[0];
    if (!move) {
      if (line.clean) issues.error('SGF_NO_MOVES', node, 'this variation has no moves');
      return;
    }
    if (move.color !== toPlay) {
      const what = i === 0 ? 'the first move' : 'this variation';
      issues.error(
        'SGF_BAD_PLAYER',
        line.firstAt ?? node,
        `${what} is ${move.color} but ${toPlay} is to play`,
      );
    }
    if (firstMoves.has(move.at)) {
      issues.error(
        'SGF_DUPLICATE_BRANCH',
        node,
        `another branch already starts with ${move.color} ${move.at}`,
      );
    }
    firstMoves.add(move.at);
  });

  if (issues.errors.length > 0) return fail();
  return {
    ok: true,
    problem: {
      size,
      setup,
      toPlay,
      line: main.moves,
      wrong: lines.slice(1).map((line) => ({ line: line.moves })),
    },
    warnings: issues.warnings,
  };
}

function boardSize(root: SgfNode, issues: Issues): LessonSize | null {
  const sz = prop(root, 'SZ');
  const supported = 'supported sizes are 5, 7 or 9';
  if (!sz) {
    issues.error('SGF_BAD_SIZE', root, `no SZ: the SGF default is 19×19; ${supported} (SZ[9])`);
    return null;
  }
  const value = sz.values[0];
  const parts = value.text.split(':').map((s) => s.trim());
  if (parts.length === 2 && parts[0] !== parts[1]) {
    issues.error('SGF_BAD_SIZE', value, `SZ[${value.text}] is not square; ${supported}`);
    return null;
  }
  const n = /^\d+$/.test(parts[0]) ? Number(parts[0]) : NaN;
  if (parts.length > 2 || !Number.isInteger(n) || n < 1 || n > 19) {
    issues.error('SGF_BAD_SIZE', value, `SZ[${value.text}] is not a board size; ${supported}`);
    return null;
  }
  if (!SIZES.includes(n as LessonSize)) {
    issues.error('SGF_BAD_SIZE', value, `board size ${n}×${n} is not supported; ${supported}`);
    return null;
  }
  return n as LessonSize;
}

/** Errors and warnings for the properties of one node (moves are read by `readLine`). */
function checkProperties(node: SgfNode, issues: Issues, isRoot: boolean): void {
  for (const p of node.props) {
    if (p.id === 'B' || p.id === 'W' || IGNORED.has(p.id) || (isRoot && p.id === 'SZ')) continue;
    if (p.id in FORBIDDEN) {
      issues.error('SGF_UNSUPPORTED_PROPERTY', p, FORBIDDEN[p.id]);
    } else if (SETUP.has(p.id)) {
      if (!isRoot) {
        issues.error('SGF_SETUP_NOT_ROOT', p, `${p.id} is only allowed in the first (root) node`);
      }
    } else if (!isRoot && (p.id === 'SZ' || p.id === 'GM')) {
      issues.error('SGF_SETUP_NOT_ROOT', p, `${p.id} is only allowed in the first (root) node`);
    } else if (p.id !== 'GM') {
      issues.warn('SGF_UNSUPPORTED_PROPERTY', p, `${p.id} is not supported and is ignored`);
    }
  }
}

function readSetup(root: SgfNode, size: LessonSize, issues: Issues) {
  const seen = new Set<string>();
  const stones: Record<Color, string[]> = { B: [], W: [] };
  for (const color of ['B', 'W'] as const) {
    const p = prop(root, `A${color}`);
    for (const value of p?.values ?? []) {
      const points = sgfPoints(value.text, size);
      if (!points) {
        issues.error(
          'SGF_BAD_POINT',
          value,
          `A${color}[${value.text}] is outside a ${size}x${size} board`,
        );
        continue;
      }
      for (const xy of points) {
        const vertex = sgfPoint(xy, size) as string;
        if (seen.has(vertex)) {
          issues.error(
            'SGF_SETUP_OVERLAP',
            value,
            `${vertex} (${xy}) appears more than once in AB/AW`,
          );
          continue;
        }
        seen.add(vertex);
        stones[color].push(vertex);
      }
    }
  }
  const setup: { B?: string[]; W?: string[] } = {};
  if (stones.B.length) setup.B = stones.B.sort(vertexOrder);
  if (stones.W.length) setup.W = stones.W.sort(vertexOrder);
  return setup;
}

function hasMove(node: SgfNode): boolean {
  return node.props.some((p) => p.id === 'B' || p.id === 'W');
}

/** Reads one branch (a chain of first children); deeper variations are errors. */
function readLine(start: SgfNode, root: SgfNode, size: LessonSize, issues: Issues) {
  const moves: MoveDef[] = [];
  let firstAt: SgfPosition | null = null;
  let node: SgfNode | undefined = start;
  while (node) {
    if (node !== root) checkProperties(node, issues, false);
    const move = readMove(node, size, issues);
    if (move) {
      const previous = moves[moves.length - 1];
      if (previous && previous.color === move.color) {
        issues.error(
          'SGF_NOT_ALTERNATING',
          node,
          `two ${move.color} moves in a row (${previous.at}, then ${move.at})`,
        );
      }
      if (moves.length === 0) firstAt = node;
      moves.push(move);
    }
    if (node.children.length > 1) {
      issues.error(
        'SGF_NESTED_VARIATION',
        node.children[1],
        'variations are only allowed at the first move (several correct answers are not supported)',
      );
    }
    node = node.children[0];
  }
  return { moves, firstAt };
}

function readMove(node: SgfNode, size: LessonSize, issues: Issues): MoveDef | null {
  const found = node.props.filter((p) => p.id === 'B' || p.id === 'W');
  if (found.length === 0) return null;
  if (found.length > 1) {
    issues.error('SGF_NOT_ALTERNATING', node, 'a node has both a B and a W move');
    return null;
  }
  const p = found[0];
  const color = p.id as Color;
  if (p.values.length !== 1) {
    issues.error('SGF_BAD_POINT', p, `a move has exactly one point: ${color}[..]`);
    return null;
  }
  const value = p.values[0];
  const xy = value.text.trim();
  if (xy === '' || (xy === 'tt' && size <= 19)) {
    issues.error(
      'SGF_PASS_UNSUPPORTED',
      value,
      `${color}[${xy}] is a pass; passes are not supported`,
    );
    return null;
  }
  const at = sgfPoint(xy, size);
  if (!at) {
    issues.error('SGF_BAD_POINT', value, `${color}[${xy}] is outside a ${size}x${size} board`);
    return null;
  }
  return { color, at };
}
