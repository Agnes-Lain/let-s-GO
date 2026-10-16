// Demo scenarios for app/dev/board.tsx: setup stones (not moves) + static markers.
// Data only — no rules here. Diagrams: docs/specs/M2-board-ui.md §5.
import type { BoardSize, Color, Vertex } from '@/engine';

import type { Highlight, Marker } from './GoBoard';
import { stonesFromSetup } from './geometry';
import { parseVertex } from '@/engine';

export type ScenarioId = 'free' | 'capture' | 'ko' | 'forbidden' | 'markers';

export interface Scenario {
  id: ScenarioId;
  /** Fixed size; `null` = the size chosen in the size control. */
  size: BoardSize | null;
  toPlay: Color;
  setup: { B?: Vertex[]; W?: Vertex[] };
  markers: { kind: 'circle' | 'triangle' | 'square' | 'cross'; at: Vertex }[];
  labels: { at: Vertex; text: string }[];
  hints: Vertex[];
}

const NONE = { markers: [], labels: [], hints: [] };

export const SCENARIOS: readonly Scenario[] = [
  { id: 'free', size: null, toPlay: 'B', setup: {}, ...NONE },
  {
    id: 'capture',
    size: 5,
    toPlay: 'B',
    setup: { B: ['c2', 'b3', 'd3'], W: ['c3'] },
    ...NONE,
  },
  {
    id: 'ko',
    size: 5,
    toPlay: 'B',
    setup: { B: ['c4', 'b3', 'c2'], W: ['d4', 'e3', 'd2', 'c3'] },
    ...NONE,
  },
  {
    id: 'forbidden',
    size: 5,
    toPlay: 'W',
    setup: { B: ['a2', 'b1', 'c3'], W: ['d3', 'c4'] },
    ...NONE,
  },
  {
    id: 'markers',
    size: 7,
    toPlay: 'B',
    setup: { B: ['c5', 'd4'], W: ['e3', 'e4'] },
    markers: [
      { kind: 'circle', at: 'c5' },
      { kind: 'triangle', at: 'e3' },
      { kind: 'square', at: 'b2' },
      { kind: 'cross', at: 'f6' },
    ],
    labels: [
      { at: 'c2', text: 'A' },
      { at: 'f2', text: 'B' },
    ],
    hints: ['d3'],
  },
];

export function scenarioBoard(scenario: Scenario, chosenSize: BoardSize) {
  const size = scenario.size ?? chosenSize;
  const point = (v: Vertex) => parseVertex(v, size);
  const markers: Marker[] = [
    ...scenario.markers.map((m) => ({ kind: m.kind, point: point(m.at) })),
    ...scenario.labels.map((l) => ({ kind: 'label' as const, point: point(l.at), text: l.text })),
  ];
  const highlights: Highlight[] = scenario.hints.length
    ? [{ kind: 'hint', points: scenario.hints.map(point) }]
    : [];
  return { size, stones: stonesFromSetup(size, scenario.setup), markers, highlights };
}
