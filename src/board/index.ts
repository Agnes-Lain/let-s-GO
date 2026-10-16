// Board UI — see docs/specs/M2-board-ui.md §3.
export { GoBoard } from './GoBoard';
export type { GoBoardProps, Highlight, HighlightKind, Marker } from './GoBoard';
export {
  boardGeometry,
  columnLabels,
  pointFromLocation,
  pointToLocation,
  rowLabels,
  starPoints,
  stonesFromSetup,
  vertexLabel,
} from './geometry';
export type { BoardGeometry } from './geometry';
