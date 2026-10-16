// <GoBoard/> — pure-presentational SVG board. No game logic: the parent owns the GameState.
// PR 1 = static drawing. Extension points for later PRs are marked "PR 2" / "PR 3".
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { parseVertex, toVertex } from '@/engine';
import type { BoardSize, Color, Point } from '@/engine';
import { board as boardColor, color, motion, opacity, radius, stone } from '@/theme/tokens';

import {
  boardGeometry,
  columnLabels,
  pointToLocation,
  rowLabels,
  starPoints,
  type BoardGeometry,
} from './geometry';
import { useReduceMotion } from './useReduceMotion';

export type HighlightKind = 'liberty' | 'hint' | 'success' | 'error';
export interface Highlight {
  kind: HighlightKind;
  points: readonly Point[];
}

export type Marker =
  | { kind: 'circle' | 'triangle' | 'square' | 'cross'; point: Point }
  | { kind: 'label'; point: Point; text: string };

export interface GoBoardProps {
  size: BoardSize;
  /** = GameState.board.cells (index y*size+x). */
  stones: readonly (Color | null)[];
  /** px; default: parent width (measured with onLayout). Always square. */
  width?: number;
  showCoordinates?: boolean;
  /** Reserved for PR 2 (touch overlay). In PR 1 no touch surface is rendered. */
  interactive?: boolean;
  highlights?: readonly Highlight[];
  markers?: readonly Marker[];
  testID?: string;
}

const STRIP_COUNT = 12;
/** Fixed node heights (fraction of board height) per strip — deterministic, no Math.random. */
const NODE_HEIGHTS = [0.18, 0.62, 0.37, 0.81, 0.27, 0.71, 0.12, 0.55, 0.88, 0.43, 0.76, 0.31];
const LINE_WIDTH = 1;
const BORDER_WIDTH = 1.5;
const RING_WIDTH = 2.5;
const MARKER_WIDTH = 2;
const SQRT3_HALF = Math.sqrt(3) / 2;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function warnDev(message: string) {
  if (__DEV__) console.warn(`[GoBoard] ${message}`);
}

export function GoBoard({
  size,
  stones,
  width,
  showCoordinates = true,
  highlights = [],
  markers = [],
  testID = 'go-board',
}: GoBoardProps) {
  const [measured, setMeasured] = useState<number | null>(null);
  const side = width ?? measured;
  const stonesValid = stones.length === size * size;

  useEffect(() => {
    if (!stonesValid) {
      warnDev(`stones has ${stones.length} cells, expected ${size * size}; drawing no stones`);
    }
  }, [stonesValid, stones.length, size]);

  const onLayout = (e: LayoutChangeEvent) => {
    if (width === undefined) setMeasured(e.nativeEvent.layout.width);
  };

  const rootStyle = side === null ? styles.rootUnmeasured : { width: side, height: side };

  return (
    <View testID={testID} style={[styles.root, rootStyle]} onLayout={onLayout}>
      {side !== null && side > 0 ? (
        <BoardDrawing
          geometry={boardGeometry(size, side, showCoordinates)}
          stones={stonesValid ? stones : []}
          showCoordinates={showCoordinates}
          highlights={highlights}
          markers={markers}
        />
      ) : null}
    </View>
  );
}

interface DrawingProps {
  geometry: BoardGeometry;
  stones: readonly (Color | null)[];
  showCoordinates: boolean;
  highlights: readonly Highlight[];
  markers: readonly Marker[];
}

function BoardDrawing({ geometry: g, stones, showCoordinates, highlights, markers }: DrawingProps) {
  const { size, width, cell } = g;
  const vertex = (p: Point) => toVertex(p, size);
  const loc = (p: Point) => pointToLocation(g, p);
  const stoneAt = (p: Point): Color | null => stones[p.y * size + p.x] ?? null;

  const warnedLabel = useRef(false);
  useEffect(() => {
    const tooLong = markers.some((m) => m.kind === 'label' && [...m.text].length > 2);
    if (tooLong && !warnedLabel.current) {
      warnedLabel.current = true;
      warnDev('label markers are limited to 2 characters; text was truncated');
    }
  }, [markers]);

  const lines = Array.from({ length: size }, (_, i) => i);
  const far = g.origin + (size - 1) * cell;
  const stoneList = useMemo(() => {
    const out: { point: Point; color: Color }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = stones[y * size + x];
        if (c) out.push({ point: { x, y }, color: c });
      }
    }
    return out;
  }, [stones, size]);

  const libertyPoints = highlights.filter((h) => h.kind === 'liberty').flatMap((h) => h.points);
  const ringHighlights = highlights.filter((h) => h.kind !== 'liberty');

  return (
    <View style={[styles.shadow, { width, height: width }]}>
      <View style={styles.clip}>
        <Svg width={width} height={width}>
          {/* 1. Bamboo */}
          <Rect x={0} y={0} width={width} height={width} fill={boardColor.bamboo} />
          {Array.from({ length: STRIP_COUNT }, (_, i) => {
            const stripW = width / STRIP_COUNT;
            return (
              <G key={i}>
                <Rect
                  x={i * stripW}
                  y={0}
                  width={stripW}
                  height={width}
                  fill={i % 2 === 0 ? boardColor.bambooStripLight : boardColor.bambooStripDark}
                />
                <Rect
                  x={i * stripW}
                  y={NODE_HEIGHTS[i] * width}
                  width={stripW}
                  height={1.5}
                  fill={boardColor.bambooNode}
                />
              </G>
            );
          })}

          {/* 2. Grid */}
          <G testID="board-grid">
            {lines.map((i) => {
              const edge = i === 0 || i === size - 1;
              const w = edge ? BORDER_WIDTH : LINE_WIDTH;
              const pos = g.origin + i * cell;
              return (
                <G key={i}>
                  <Line
                    testID={`board-grid-h-${i}`}
                    x1={g.origin}
                    y1={pos}
                    x2={far}
                    y2={pos}
                    stroke={boardColor.line}
                    strokeWidth={w}
                  />
                  <Line
                    testID={`board-grid-v-${i}`}
                    x1={pos}
                    y1={g.origin}
                    x2={pos}
                    y2={far}
                    stroke={boardColor.line}
                    strokeWidth={w}
                  />
                </G>
              );
            })}
          </G>

          {/* 3. Star points */}
          {starPoints(size).map((v) => {
            const c = loc(parseVertex(v, size));
            return (
              <Circle
                key={v}
                testID={`board-star-${v}`}
                cx={c.x}
                cy={c.y}
                r={g.starRadius}
                fill={boardColor.line}
              />
            );
          })}

          {/* 4. Coordinate labels: letters along the bottom, numbers along the left */}
          {showCoordinates &&
            columnLabels(size).map((letter, x) => (
              <SvgText
                key={`col-${letter}`}
                testID={`board-label-col-${letter}`}
                x={g.origin + x * cell}
                y={far + g.origin / 2 + g.labelFontSize * 0.35}
                fontSize={g.labelFontSize}
                fontWeight="500"
                textAnchor="middle"
                fill={boardColor.line}
                fillOpacity={opacity.label}
              >
                {letter}
              </SvgText>
            ))}
          {showCoordinates &&
            rowLabels(size).map((label, row) => (
              <SvgText
                key={`row-${label}`}
                testID={`board-label-row-${label}`}
                x={g.origin / 2}
                y={g.origin + row * cell + g.labelFontSize * 0.35}
                fontSize={g.labelFontSize}
                fontWeight="500"
                textAnchor="middle"
                fill={boardColor.line}
                fillOpacity={opacity.label}
              >
                {label}
              </SvgText>
            ))}

          {/* 5. Liberty highlights (below stones) */}
          {libertyPoints.map((p) => {
            const c = loc(p);
            return (
              <Circle
                key={`liberty-${vertex(p)}`}
                testID={`board-highlight-liberty-${vertex(p)}`}
                cx={c.x}
                cy={c.y}
                r={0.22 * cell}
                fill={color.accent}
                fillOpacity={opacity.libertyFill}
                stroke={color.accent}
                strokeWidth={1.5}
              />
            );
          })}

          {/* 6. Crosshair — PR 2 */}

          {/* 7. Stones */}
          {stoneList.map(({ point, color: c }) => {
            const p = loc(point);
            return (
              <Circle
                key={`stone-${vertex(point)}`}
                testID={`board-stone-${vertex(point)}`}
                cx={p.x}
                cy={p.y}
                r={g.stoneRadius}
                fill={c === 'B' ? stone.black : stone.white}
                stroke={c === 'W' ? stone.whiteEdge : undefined}
                strokeWidth={c === 'W' ? 1 : undefined}
              />
            );
          })}

          {/* 8. Last-move dot — PR 2 */}

          {/* 9. Markers */}
          {markers.map((m, i) => (
            <MarkerShape
              key={`${m.kind}-${vertex(m.point)}-${i}`}
              marker={m}
              g={g}
              on={stoneAt(m.point)}
            />
          ))}

          {/* 10. Rings: hint / success / error */}
          {ringHighlights.flatMap((h) =>
            h.points.map((p) => {
              const c = loc(p);
              const id = `board-highlight-${h.kind}-${vertex(p)}`;
              const stroke =
                h.kind === 'hint' ? color.hint : h.kind === 'success' ? color.success : color.error;
              return h.kind === 'hint' ? (
                <HintRing key={id} testID={id} cx={c.x} cy={c.y} r={0.5 * cell} stroke={stroke} />
              ) : (
                <Circle
                  key={id}
                  testID={id}
                  cx={c.x}
                  cy={c.y}
                  r={0.5 * cell}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={RING_WIDTH}
                />
              );
            }),
          )}

          {/* 11. Preview (ghost / illegal ring / tag) — PR 2 */}
        </Svg>
      </View>
    </View>
  );
}

function MarkerShape({ marker, g, on }: { marker: Marker; g: BoardGeometry; on: Color | null }) {
  const { cell } = g;
  const c = pointToLocation(g, marker.point);
  const v = toVertex(marker.point, g.size);
  const stroke = on === 'B' ? stone.white : boardColor.line;
  const id = `board-marker-${marker.kind}-${v}`;
  const common = { stroke, strokeWidth: MARKER_WIDTH, fill: 'none' } as const;

  switch (marker.kind) {
    case 'circle':
      return <Circle testID={id} cx={c.x} cy={c.y} r={0.25 * cell} {...common} />;
    case 'square': {
      const s = 0.44 * cell;
      return <Rect testID={id} x={c.x - s / 2} y={c.y - s / 2} width={s} height={s} {...common} />;
    }
    case 'triangle': {
      const side = 0.55 * cell;
      const h = side * SQRT3_HALF;
      const points = [
        `${c.x},${c.y - (2 * h) / 3}`,
        `${c.x - side / 2},${c.y + h / 3}`,
        `${c.x + side / 2},${c.y + h / 3}`,
      ].join(' ');
      return <Polygon testID={id} points={points} {...common} />;
    }
    case 'cross': {
      const d = 0.2 * cell;
      return (
        <G testID={id}>
          <Line x1={c.x - d} y1={c.y - d} x2={c.x + d} y2={c.y + d} {...common} />
          <Line x1={c.x - d} y1={c.y + d} x2={c.x + d} y2={c.y - d} {...common} />
        </G>
      );
    }
    case 'label': {
      const text = [...marker.text].slice(0, 2).join('');
      const fontSize = Math.max(10, 0.42 * cell);
      return (
        <G>
          {on === null ? (
            <Circle
              testID={`board-marker-label-mask-${v}`}
              cx={c.x}
              cy={c.y}
              r={0.32 * cell}
              fill={boardColor.bamboo}
            />
          ) : null}
          <SvgText
            testID={id}
            x={c.x}
            y={c.y + fontSize * 0.35}
            fontSize={fontSize}
            fontWeight="600"
            textAnchor="middle"
            fill={on === 'B' ? stone.white : boardColor.line}
          >
            {text}
          </SvgText>
        </G>
      );
    }
  }
}

/** Hint ring: pulses (scale 1 → 1.15, opacity 1 → 0.5) 3 × 1200 ms, then stays static. */
function HintRing({
  testID,
  cx,
  cy,
  r,
  stroke,
}: {
  testID: string;
  cx: number;
  cy: number;
  r: number;
  stroke: string;
}) {
  const reduceMotion = useReduceMotion();
  const [phase] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      phase.setValue(0);
      return;
    }
    const half = motion.hintPulse / 2;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, { toValue: 1, duration: half, useNativeDriver: false }),
        Animated.timing(phase, { toValue: 0, duration: half, useNativeDriver: false }),
      ]),
      { iterations: motion.hintPulseCycles },
    );
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, phase]);

  return (
    <AnimatedCircle
      testID={testID}
      cx={cx}
      cy={cy}
      r={phase.interpolate({ inputRange: [0, 1], outputRange: [r, r * 1.15] })}
      fill="none"
      stroke={stroke}
      strokeWidth={RING_WIDTH}
      opacity={phase.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] })}
    />
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center' },
  rootUnmeasured: { width: '100%', aspectRatio: 1 },
  shadow: Platform.select({
    web: { boxShadow: `0 0 2px ${boardColor.line}2E`, borderRadius: radius.sm },
    ios: {
      borderRadius: radius.sm,
      shadowColor: boardColor.line,
      shadowOpacity: 0.18,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
    },
    default: { borderRadius: radius.sm, elevation: 2 },
  }),
  clip: { flex: 1, borderRadius: radius.sm, overflow: 'hidden' },
});
