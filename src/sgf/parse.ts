// SGF parser (spec docs/specs/M5-sgf-import.md §4, AC 1–9). Pure TS, no dependencies.
//
//   Collection = GameTree      (exactly one: a second tree is SGF_MULTIPLE_GAMES)
//   GameTree   = "(" Node+ GameTree* ")"
//   Node       = ";" Property*
//   Property   = Ident Value+          Ident = letters (legacy lower-case letters are dropped)
//   Value      = "[" text "]"          "\" escapes the next character; "\" + newline is removed
//
// Iterative (no recursion), so deeply nested or huge input cannot overflow the stack. Stops at
// the first error: one syntax error usually makes everything after it meaningless.

import type { ParseResult, SgfIssue, SgfNode, SgfPosition, SgfProperty } from './types';

class Cursor {
  i = 0;
  line = 1;
  col = 1;

  constructor(readonly text: string) {}

  get done(): boolean {
    return this.i >= this.text.length;
  }

  get char(): string {
    return this.text[this.i];
  }

  get pos(): SgfPosition {
    return { line: this.line, col: this.col };
  }

  /** Moves one UTF-16 unit forward, counting lines (\n, \r\n, \r) and characters. */
  next(): void {
    const c = this.text[this.i];
    this.i++;
    if (c === '\n' || (c === '\r' && this.text[this.i] !== '\n')) {
      this.line++;
      this.col = 1;
    } else if (c === '\r') {
      // the \n of a \r\n counts the line
    } else if (!isHighSurrogate(c)) {
      this.col++;
    }
  }

  skipSpace(): void {
    while (!this.done && /\s/.test(this.char)) this.next();
  }
}

function isHighSurrogate(c: string): boolean {
  const code = c.charCodeAt(0);
  return code >= 0xd800 && code <= 0xdbff;
}

function isLetter(c: string): boolean {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
}

class ParseError {
  constructor(readonly issue: SgfIssue) {}
}

function fail(code: string, at: SgfPosition, message: string): never {
  throw new ParseError({ code, message, line: at.line, col: at.col });
}

/** Character shown in messages. */
function shown(c: string): string {
  return c === '\n' || c === '\r' ? 'a line break' : `"${c}"`;
}

interface Frame {
  open: SgfPosition;
  /** Node the tree hangs from (null for the game tree itself). */
  parent: SgfNode | null;
  /** Last node of this tree's sequence. */
  last: SgfNode | null;
  /** A child tree started: no more nodes may follow in this sequence. */
  branched: boolean;
}

export function parseSgf(text: string): ParseResult {
  const body = text.startsWith('﻿') ? text.slice(1) : text;
  if (body.trim() === '') {
    return {
      ok: false,
      errors: [{ code: 'SGF_EMPTY', message: 'the file is empty', line: 1, col: 1 }],
    };
  }
  try {
    return { ok: true, tree: parseTree(new Cursor(body)), warnings: [] };
  } catch (error) {
    if (error instanceof ParseError) return { ok: false, errors: [error.issue] };
    throw error;
  }
}

function parseTree(cur: Cursor): SgfNode {
  let root: SgfNode | null = null;
  const stack: Frame[] = [];

  for (;;) {
    cur.skipSpace();
    if (cur.done) break;
    const at = cur.pos;
    const c = cur.char;
    const frame = stack[stack.length - 1];

    if (c === '(') {
      if (!frame) {
        if (root) fail('SGF_MULTIPLE_GAMES', at, 'only one game per file: found a second "("');
        stack.push({ open: at, parent: null, last: null, branched: false });
      } else {
        if (!frame.last) fail('SGF_SYNTAX', at, 'expected ";" to start a node, found "("');
        frame.branched = true;
        stack.push({ open: at, parent: frame.last, last: null, branched: false });
      }
      cur.next();
      cur.skipSpace();
      if (cur.done) break;
      if (cur.char !== ';') {
        fail('SGF_SYNTAX', cur.pos, `expected ";" to start a node, found ${shown(cur.char)}`);
      }
      continue;
    }

    if (c === ';' && frame) {
      if (frame.branched) {
        fail('SGF_SYNTAX', at, 'a node cannot follow a variation; close the tree with ")" first');
      }
      cur.next();
      const node: SgfNode = { ...at, props: parseProperties(cur), children: [] };
      if (frame.last) frame.last.children.push(node);
      else if (frame.parent) frame.parent.children.push(node);
      else root = node;
      frame.last = node;
      continue;
    }

    if (c === ')') {
      if (!frame) fail('SGF_UNBALANCED_PARENS', at, '")" without a matching "("');
      if (!frame.last) fail('SGF_SYNTAX', at, 'expected ";" to start a node, found ")"');
      stack.pop();
      cur.next();
      continue;
    }

    if (!frame && root) fail('SGF_SYNTAX', at, `unexpected ${shown(c)} after the game`);
    if (!frame) fail('SGF_SYNTAX', at, `an SGF file starts with "(;", found ${shown(c)}`);
    fail('SGF_SYNTAX', at, `unexpected ${shown(c)}`);
  }

  if (stack.length > 0) {
    fail('SGF_UNBALANCED_PARENS', stack[stack.length - 1].open, 'this "(" is never closed');
  }
  return root as SgfNode;
}

function parseProperties(cur: Cursor): SgfProperty[] {
  const props: SgfProperty[] = [];
  for (;;) {
    cur.skipSpace();
    if (cur.done || !isLetter(cur.char)) return props;
    const at = cur.pos;
    let raw = '';
    while (!cur.done && isLetter(cur.char)) {
      raw += cur.char;
      cur.next();
    }
    const id = raw.replace(/[a-z]/g, '');
    if (id === '') fail('SGF_SYNTAX', at, `"${raw}" is not a property name (use capital letters)`);
    const prop: SgfProperty = { ...at, id, values: [] };
    cur.skipSpace();
    while (!cur.done && cur.char === '[') {
      prop.values.push(parseValue(cur));
      cur.skipSpace();
    }
    if (prop.values.length === 0) {
      const found = cur.done ? 'the end of the file' : shown(cur.char);
      fail('SGF_SYNTAX', cur.pos, `expected "[" after ${id}, found ${found}`);
    }
    props.push(prop);
  }
}

function parseValue(cur: Cursor) {
  const at = cur.pos;
  cur.next(); // [
  let text = '';
  while (!cur.done) {
    const c = cur.char;
    if (c === ']') {
      cur.next();
      return { ...at, text };
    }
    cur.next();
    if (c !== '\\') {
      text += c;
      continue;
    }
    if (cur.done) break;
    const escaped = cur.char;
    cur.next();
    if (escaped === '\n' || escaped === '\r') {
      // soft line break: drop it, including the second half of \r\n or \n\r
      const pair = escaped === '\n' ? '\r' : '\n';
      if (!cur.done && cur.char === pair) cur.next();
      continue;
    }
    text += escaped;
  }
  return fail('SGF_UNTERMINATED_VALUE', at, 'this "[" is never closed with "]"');
}
