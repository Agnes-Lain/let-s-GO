// <GoBoard/> — pure-presentational SVG board. No game logic: the parent owns the GameState.
// PR 1 = static drawing. Extension points for later PRs are marked "PR 2" / "PR 3".
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import '@/i18n';
import { parseVertex, toVertex } from '@/engine';
import type { BoardSize, CheckResult, Color, IllegalReason, Point } from '@/engine';
import { board as boardColor, color, motion, opacity, radius, stone } from '@/theme/tokens';

import {
  boardGeometry,
  columnLabels,
  pointFromLocation,
  pointToLocation,
  rowLabels,
  starPoints,
  vertexLabel,
  type BoardGeometry,
} from './geometry';
import { captureAnimation, isStonePlaced, placementAnimation } from './motionPlan';
import { playStoneSound } from './sound';
import { useReduceMotion } from './useReduceMotion';
import { useScreenReader } from './useScreenReader';

export type HighlightKind = 'liberty' | 'hint' | 'success' | 'error';
export interface Highlight {
  kind: HighlightKind;
  points: readonly Point[];
}

export type Marker =
  | { kind: 'circle' | 'triangle' | 'square' | 'cross'; point: Point }
  | { kind: 'label'; point: Point; text: string };

export interface CaptureEvent {
  /** Changes once per move (e.g. the move number); the same id is never announced twice. */
  id: number;
  /** Color of the captured stones. */
  color: Color;
  points: readonly Point[];
}

export interface GoBoardProps {
  size: BoardSize;
  /** = GameState.board.cells (index y*size+x). */
  stones: readonly (Color | null)[];
  /** px; default: parent width (measured with onLayout). Always square. */
  width?: number;
  showCoordinates?: boolean;
  /** Adds the touch surface (preview on touch-down, commit on touch-up). Default false. */
  interactive?: boolean;
  /** Interactive but locked: no preview, no callbacks. */
  disabled?: boolean;
  /** Ghost-stone color. Default 'B'. */
  playerColor?: Color;
  /** Asked on every preview. Default: occupied -> illegal 'occupied', otherwise legal. */
  checkPoint?: (p: Point) => CheckResult;
  /** Touch-up on a legal point. The board does not draw the stone: the parent passes new `stones`. */
  onPlay?: (p: Point) => void;
  /** Touch-up on an illegal point. */
  onIllegal?: (p: Point, reason: IllegalReason) => void;
  lastMove?: Point | null;
  /** Screen-reader announcement and capture fade-out; each `id` plays once. */
  lastCapture?: CaptureEvent | null;
  /** Stone sound on/off. Default true; plays only when a stone appears. */
  sound?: boolean;
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
const ILLEGAL_RING_WIDTH = 2;
const CROSSHAIR_WIDTH = 1.5;
const TAG_HEIGHT = 22;
const TAG_MIN_WIDTH = 28;
const NO_HIGHLIGHTS: readonly Highlight[] = [];
const NO_MARKERS: readonly Marker[] = [];
const NO_STONES: readonly (Color | null)[] = [];
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
  interactive = false,
  disabled = false,
  playerColor = 'B',
  checkPoint,
  onPlay,
  onIllegal,
  lastMove = null,
  lastCapture = null,
  sound = true,
  highlights = NO_HIGHLIGHTS,
  markers = NO_MARKERS,
  testID = 'go-board',
}: GoBoardProps) {
  const { t } = useTranslation();
  const screenReader = useScreenReader();
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
  const validStones = stonesValid ? stones : NO_STONES;
  const label = t('board.a11y.label', {
    size,
    black: validStones.filter((c) => c === 'B').length,
    white: validStones.filter((c) => c === 'W').length,
  });

  return (
    <View
      testID={testID}
      style={[styles.root, rootStyle]}
      onLayout={onLayout}
      accessibilityLabel={label}
      accessible={!screenReader}
    >
      {side !== null && side > 0 ? (
        <BoardDrawing
          geometry={boardGeometry(size, side, showCoordinates)}
          stones={validStones}
          showCoordinates={showCoordinates}
          highlights={highlights}
          markers={markers}
          interactive={interactive}
          disabled={disabled}
          playerColor={playerColor}
          checkPoint={checkPoint}
          onPlay={onPlay}
          onIllegal={onIllegal}
          lastMove={lastMove}
          lastCapture={lastCapture}
          sound={sound}
          screenReader={screenReader}
        />
      ) : null}
    </View>
  );
}

interface Preview {
  point: Point;
  result: CheckResult;
  /** Illegal ring after touch-up: fading out over `motion.illegalFade`. */
  fading: boolean;
}

interface DrawingProps {
  geometry: BoardGeometry;
  stones: readonly (Color | null)[];
  showCoordinates: boolean;
  highlights: readonly Highlight[];
  markers: readonly Marker[];
  interactive: boolean;
  disabled: boolean;
  playerColor: Color;
  checkPoint: GoBoardProps['checkPoint'];
  onPlay: GoBoardProps['onPlay'];
  onIllegal: GoBoardProps['onIllegal'];
  lastMove: Point | null;
  lastCapture: CaptureEvent | null;
  sound: boolean;
  screenReader: boolean;
}

const sameCells = (a: readonly (Color | null)[], b: readonly (Color | null)[]) =>
  a.length === b.length && a.every((c, i) => c === b[i]);

const samePoint = (a: Point | null, b: Point | null) =>
  a !== null && b !== null && a.x === b.x && a.y === b.y;

function BoardDrawing({
  geometry,
  stones,
  showCoordinates,
  highlights,
  markers,
  interactive,
  disabled,
  playerColor,
  checkPoint,
  onPlay,
  onIllegal,
  lastMove,
  lastCapture,
  sound,
  screenReader,
}: DrawingProps) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  // The geometry object is rebuilt by the parent every render; keep the identity stable.
  const g = useMemo(
    () => geometry,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geometry.size, geometry.width, geometry.cell, geometry.origin],
  );
  const { size, cell } = g;

  const warnedLabel = useRef(false);
  useEffect(() => {
    const tooLong = markers.some((m) => m.kind === 'label' && [...m.text].length > 2);
    if (tooLong && !warnedLabel.current) {
      warnedLabel.current = true;
      warnDev('label markers are limited to 2 characters; text was truncated');
    }
  }, [markers]);

  // ---- Touch preview (spec 4.3) ----
  const [preview, setPreview] = useState<Preview | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touching = useRef(false);
  const canTouch = interactive && !disabled;

  const clearFadeTimer = () => {
    if (fadeTimer.current !== null) clearTimeout(fadeTimer.current);
    fadeTimer.current = null;
  };
  useEffect(() => clearFadeTimer, []);
  // Locking the board (or turning interaction off) drops any preview at once.
  const [wasTouchable, setWasTouchable] = useState(canTouch);
  if (wasTouchable !== canTouch) {
    setWasTouchable(canTouch);
    if (!canTouch) setPreview(null);
  }
  useEffect(() => {
    if (!canTouch) {
      touching.current = false;
      clearFadeTimer();
    }
  }, [canTouch]);

  const check = (p: Point): CheckResult => {
    if (checkPoint) return checkPoint(p);
    return stones[p.y * size + p.x] ? { legal: false, reason: 'occupied' } : { legal: true };
  };
  const pointAt = (e: GestureResponderEvent): Point | null => {
    const { locationX, locationY } = e.nativeEvent;
    if (!Number.isFinite(locationX) || !Number.isFinite(locationY)) return null;
    return pointFromLocation(g, locationX, locationY);
  };
  const showPreviewAt = (p: Point | null) => {
    if (p === null) {
      setPreview(null);
      return;
    }
    setPreview((prev) =>
      prev && !prev.fading && samePoint(prev.point, p)
        ? prev
        : { point: p, result: check(p), fading: false },
    );
  };

  const onGrant = (e: GestureResponderEvent) => {
    if (!canTouch || touching.current) return;
    touching.current = true;
    clearFadeTimer();
    showPreviewAt(pointAt(e));
  };
  const onMove = (e: GestureResponderEvent) => {
    if (!canTouch || !touching.current) return;
    showPreviewAt(pointAt(e));
  };
  const onRelease = (e: GestureResponderEvent) => {
    if (!canTouch || !touching.current) return;
    touching.current = false;
    const p = pointAt(e);
    if (p === null) {
      setPreview(null);
      return;
    }
    const result = check(p);
    if (result.legal) {
      setPreview(null);
      onPlay?.(p);
      return;
    }
    setPreview({ point: p, result, fading: true });
    clearFadeTimer();
    fadeTimer.current = setTimeout(() => {
      fadeTimer.current = null;
      setPreview(null);
    }, motion.illegalFade);
    onIllegal?.(p, result.reason);
  };
  const onCancel = () => {
    touching.current = false;
    setPreview(null);
  };

  // ---- Screen-reader announcements (spec 4.5) ----
  const previous = useRef({ stones, captureId: lastCapture?.id ?? null });
  useEffect(() => {
    const before = previous.current;
    previous.current = { stones, captureId: lastCapture?.id ?? null };
    if (!screenReader || !lastMove) return;
    const index = lastMove.y * size + lastMove.x;
    const placed = stones[index];
    if (!placed || before.stones[index] != null) return; // not a new stone (e.g. undo)
    const parts = [t(`board.a11y.played.${placed}`, { vertex: vertexLabel(lastMove, size) })];
    if (lastCapture && lastCapture.id !== before.captureId && lastCapture.points.length > 0) {
      parts.push(t('board.a11y.captured', { count: lastCapture.points.length }));
    }
    AccessibilityInfo.announceForAccessibility(parts.join(t('board.a11y.separator')));
  }, [stones, lastMove, lastCapture, screenReader, size, t]);

  // ---- Sound: only when a stone actually appears (not mount, undo, reset, illegal move) ----
  const soundBefore = useRef(stones);
  useEffect(() => {
    const before = soundBefore.current;
    soundBefore.current = stones;
    if (sound && isStonePlaced(before, stones, lastMove, size)) void playStoneSound();
  }, [stones, lastMove, sound, size]);

  // ---- Placement & capture animation (spec 4.4). Derived during render so the first frame is right. ----
  const captureId = lastCapture?.id ?? null;
  const [seen, setSeen] = useState({ stones, captureId });
  const [placed, setPlaced] = useState<number | null>(null);
  const [capture, setCapture] = useState<CaptureEvent | null>(null);
  if (seen.stones !== stones || seen.captureId !== captureId) {
    setSeen({ stones, captureId });
    const appeared = isStonePlaced(seen.stones, stones, lastMove, size);
    if (lastMove && appeared && !reduceMotion) setPlaced(lastMove.y * size + lastMove.x);
    if (appeared && lastCapture && captureId !== seen.captureId) {
      // A newer capture replaces (and so instantly ends) the previous one.
      setCapture(reduceMotion || lastCapture.points.length === 0 ? null : lastCapture);
    } else if (captureId !== seen.captureId || !sameCells(seen.stones, stones)) {
      // Undo / reset / capture cleared: a fade must never outlive or replay over a changed board.
      setCapture(null);
    }
  }
  const placedDone = useCallback(() => setPlaced(null), []);
  const captureDone = useCallback((id: number) => setCapture((c) => (c?.id === id ? null : c)), []);

  const activate = (p: Point) => {
    if (!canTouch) return;
    const result = check(p);
    if (result.legal) onPlay?.(p);
    else onIllegal?.(p, result.reason);
  };

  const crosshairOn = preview !== null && !preview.fading && cell < 44;

  return (
    <View style={[styles.shadow, { width: g.width, height: g.width }]}>
      <View style={styles.clip}>
        <Svg width={g.width} height={g.width}>
          <BoardBase g={g} />
          <Labels
            g={g}
            show={showCoordinates}
            activeColumn={crosshairOn ? preview.point.x : null}
            activeRow={crosshairOn ? preview.point.y : null}
          />
          <LibertyLayer g={g} highlights={highlights} />
          {crosshairOn ? <Crosshair g={g} point={preview.point} /> : null}
          <StoneLayer g={g} stones={stones} placed={placed} onPlacedDone={placedDone} />
          {capture ? (
            <CaptureLayer key={capture.id} g={g} capture={capture} onDone={captureDone} />
          ) : null}
          <LastMoveDot g={g} stones={stones} lastMove={lastMove} markers={markers} />
          <MarkerLayer g={g} stones={stones} markers={markers} />
          <RingLayer g={g} highlights={highlights} />
          {preview ? (
            <PreviewLayer g={g} preview={preview} playerColor={playerColor} tag={crosshairOn} />
          ) : null}
        </Svg>
      </View>
      {interactive ? (
        <View
          testID="board-touch"
          style={[styles.touch, Platform.OS === 'web' ? styles.touchWeb : null]}
          onStartShouldSetResponder={() => canTouch}
          onMoveShouldSetResponder={() => canTouch}
          onResponderGrant={onGrant}
          onResponderMove={onMove}
          onResponderRelease={onRelease}
          onResponderTerminate={onCancel}
          onResponderTerminationRequest={() => false}
        />
      ) : null}
      {screenReader ? (
        <PointsLayer
          g={g}
          stones={stones}
          lastMove={lastMove}
          markers={markers}
          highlights={highlights}
          interactive={interactive}
          disabled={disabled}
          onActivate={activate}
        />
      ) : null}
    </View>
  );
}

const BoardBase = memo(function BoardBase({ g }: { g: BoardGeometry }) {
  const { size, width, cell } = g;
  const lines = Array.from({ length: size }, (_, i) => i);
  const far = g.origin + (size - 1) * cell;
  return (
    <>
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
        const c = pointToLocation(g, parseVertex(v, size));
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
    </>
  );
});

/** 4. Coordinate labels: letters along the bottom, numbers along the left. */
const Labels = memo(function Labels({
  g,
  show,
  activeColumn,
  activeRow,
}: {
  g: BoardGeometry;
  show: boolean;
  /** Column / row index (Point.x / Point.y) of the previewed point: its labels turn accent. */
  activeColumn: number | null;
  activeRow: number | null;
}) {
  if (!show) return null;
  const { size, cell } = g;
  const far = g.origin + (size - 1) * cell;
  return (
    <>
      {columnLabels(size).map((letter, x) => {
        const active = x === activeColumn;
        return (
          <SvgText
            key={`col-${letter}`}
            testID={`board-label-col-${letter}`}
            x={g.origin + x * cell}
            y={far + g.labelOffset + g.labelFontSize * 0.35}
            fontSize={g.labelFontSize}
            fontWeight={active ? '700' : '500'}
            textAnchor="middle"
            fill={active ? color.accent : boardColor.line}
            fillOpacity={active ? 1 : opacity.label}
          >
            {letter}
          </SvgText>
        );
      })}
      {rowLabels(size).map((label, row) => {
        const active = size - 1 - row === activeRow;
        return (
          <SvgText
            key={`row-${label}`}
            testID={`board-label-row-${label}`}
            x={g.origin - g.labelOffset}
            y={g.origin + row * cell + g.labelFontSize * 0.35}
            fontSize={g.labelFontSize}
            fontWeight={active ? '700' : '500'}
            textAnchor="middle"
            fill={active ? color.accent : boardColor.line}
            fillOpacity={active ? 1 : opacity.label}
          >
            {label}
          </SvgText>
        );
      })}
    </>
  );
});

/** 5. Liberty highlights (below stones). */
const LibertyLayer = memo(function LibertyLayer({
  g,
  highlights,
}: {
  g: BoardGeometry;
  highlights: readonly Highlight[];
}) {
  const points = highlights.filter((h) => h.kind === 'liberty').flatMap((h) => h.points);
  return (
    <>
      {points.map((p) => {
        const c = pointToLocation(g, p);
        const v = toVertex(p, g.size);
        return (
          <Circle
            key={`liberty-${v}`}
            testID={`board-highlight-liberty-${v}`}
            cx={c.x}
            cy={c.y}
            r={0.22 * g.cell}
            fill={color.accent}
            fillOpacity={opacity.libertyFill}
            stroke={color.accent}
            strokeWidth={1.5}
          />
        );
      })}
    </>
  );
});

/** 6. Crosshair (preview, cell < 44 px): row and column lines through the previewed point. */
function Crosshair({ g, point }: { g: BoardGeometry; point: Point }) {
  const c = pointToLocation(g, point);
  const far = g.origin + (g.size - 1) * g.cell;
  const common = {
    stroke: color.accent,
    strokeWidth: CROSSHAIR_WIDTH,
    strokeOpacity: opacity.crosshair,
  } as const;
  return (
    <G testID="board-crosshair">
      <Line x1={g.origin} y1={c.y} x2={far} y2={c.y} {...common} />
      <Line x1={c.x} y1={g.origin} x2={c.x} y2={far} {...common} />
    </G>
  );
}

/** 7. Stones. */
const StoneLayer = memo(function StoneLayer({
  g,
  stones,
  placed,
  onPlacedDone,
}: {
  g: BoardGeometry;
  stones: readonly (Color | null)[];
  /** Index (y*size+x) of the stone that plays the placement animation, if any. */
  placed: number | null;
  onPlacedDone: () => void;
}) {
  const { size } = g;
  const list: { point: Point; color: Color }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = stones[y * size + x];
      if (c) list.push({ point: { x, y }, color: c });
    }
  }
  return (
    <>
      {list.map(({ point, color: c }) => {
        const p = pointToLocation(g, point);
        const common = {
          testID: `board-stone-${toVertex(point, size)}`,
          cx: p.x,
          cy: p.y,
          r: g.stoneRadius,
          fill: c === 'B' ? stone.black : stone.white,
          stroke: c === 'W' ? stone.whiteEdge : undefined,
          strokeWidth: c === 'W' ? 1 : undefined,
        };
        const key = `stone-${toVertex(point, size)}`;
        return point.y * size + point.x === placed ? (
          <PlacedStone key={key} {...common} onDone={onPlacedDone} />
        ) : (
          <Circle key={key} {...common} />
        );
      })}
    </>
  );
});

interface StoneCircleProps {
  testID: string;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string | undefined;
  strokeWidth: number | undefined;
}

/** New stone: scale 0.9 -> 1 and opacity 0.6 -> 1, ease-out (`placementAnimation`). */
function PlacedStone({ r, onDone, ...rest }: StoneCircleProps & { onDone: () => void }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(t, {
      toValue: 1,
      duration: placementAnimation.duration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => animation.stop();
  }, [t, onDone]);
  return (
    <AnimatedCircle
      {...rest}
      r={t.interpolate({ inputRange: [0, 1], outputRange: [r * placementAnimation.scaleFrom, r] })}
      opacity={t.interpolate({
        inputRange: [0, 1],
        outputRange: [placementAnimation.opacityFrom, 1],
      })}
    />
  );
}

/** Captured stones (already gone from `stones`) fade out together: scale 1 -> 0.8, opacity 1 -> 0. */
function CaptureLayer({
  g,
  capture,
  onDone,
}: {
  g: BoardGeometry;
  capture: CaptureEvent;
  onDone: (id: number) => void;
}) {
  const [t] = useState(() => new Animated.Value(0));
  const { id } = capture;
  useEffect(() => {
    const animation = Animated.timing(t, {
      toValue: 1,
      duration: captureAnimation.duration,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) onDone(id);
    });
    return () => animation.stop();
  }, [t, id, onDone]);
  const r = t.interpolate({
    inputRange: [0, 1],
    outputRange: [g.stoneRadius, g.stoneRadius * captureAnimation.scaleTo],
  });
  const opacityValue = t.interpolate({
    inputRange: [0, 1],
    outputRange: [1, captureAnimation.opacityTo],
  });
  const white = capture.color === 'W';
  return (
    <>
      {capture.points.map((point) => {
        const c = pointToLocation(g, point);
        const v = toVertex(point, g.size);
        return (
          <AnimatedCircle
            key={`capture-${v}`}
            testID={`board-capture-${v}`}
            cx={c.x}
            cy={c.y}
            r={r}
            fill={white ? stone.white : stone.black}
            stroke={white ? stone.whiteEdge : undefined}
            strokeWidth={white ? 1 : undefined}
            opacity={opacityValue}
          />
        );
      })}
    </>
  );
}

/** 8. Last-move dot: small filled dot in the opposite stone color; hidden under a marker. */
const LastMoveDot = memo(function LastMoveDot({
  g,
  stones,
  lastMove,
  markers,
}: {
  g: BoardGeometry;
  stones: readonly (Color | null)[];
  lastMove: Point | null;
  markers: readonly Marker[];
}) {
  if (!lastMove) return null;
  const on = stones[lastMove.y * g.size + lastMove.x] ?? null;
  if (on === null || markers.some((m) => samePoint(m.point, lastMove))) return null;
  const c = pointToLocation(g, lastMove);
  return (
    <Circle
      testID="board-last-move"
      cx={c.x}
      cy={c.y}
      r={g.lastMoveRadius}
      fill={on === 'B' ? stone.white : stone.black}
    />
  );
});

/** 9. Markers. */
const MarkerLayer = memo(function MarkerLayer({
  g,
  stones,
  markers,
}: {
  g: BoardGeometry;
  stones: readonly (Color | null)[];
  markers: readonly Marker[];
}) {
  return (
    <>
      {markers.map((m, i) => (
        <MarkerShape
          key={`${m.kind}-${toVertex(m.point, g.size)}-${i}`}
          marker={m}
          g={g}
          on={stones[m.point.y * g.size + m.point.x] ?? null}
        />
      ))}
    </>
  );
});

/** 10. Rings: hint / success / error. */
const RingLayer = memo(function RingLayer({
  g,
  highlights,
}: {
  g: BoardGeometry;
  highlights: readonly Highlight[];
}) {
  return (
    <>
      {highlights
        .filter((h) => h.kind !== 'liberty')
        .flatMap((h) =>
          h.points.map((p) => {
            const c = pointToLocation(g, p);
            const id = `board-highlight-${h.kind}-${toVertex(p, g.size)}`;
            const stroke =
              h.kind === 'hint' ? color.hint : h.kind === 'success' ? color.success : color.error;
            return h.kind === 'hint' ? (
              <HintRing key={id} testID={id} cx={c.x} cy={c.y} r={0.5 * g.cell} stroke={stroke} />
            ) : (
              <Circle
                key={id}
                testID={id}
                cx={c.x}
                cy={c.y}
                r={0.5 * g.cell}
                fill="none"
                stroke={stroke}
                strokeWidth={RING_WIDTH}
              />
            );
          }),
        )}
    </>
  );
});

/** 11. Preview: ghost stone or illegal ring, plus the coordinate tag when the crosshair shows. */
function PreviewLayer({
  g,
  preview,
  playerColor,
  tag,
}: {
  g: BoardGeometry;
  preview: Preview;
  playerColor: Color;
  tag: boolean;
}) {
  const c = pointToLocation(g, preview.point);
  return (
    <>
      {preview.result.legal ? (
        <Circle
          testID="board-ghost"
          cx={c.x}
          cy={c.y}
          r={g.stoneRadius}
          fill={playerColor === 'B' ? stone.black : stone.white}
          stroke={playerColor === 'W' ? stone.whiteEdge : undefined}
          strokeWidth={playerColor === 'W' ? 1 : undefined}
          opacity={opacity.ghost}
        />
      ) : (
        <IllegalRing cx={c.x} cy={c.y} r={0.44 * g.cell} fading={preview.fading} />
      )}
      {tag ? <CoordinateTag g={g} point={preview.point} /> : null}
    </>
  );
}

/** Dashed error ring; after touch-up it fades out over `motion.illegalFade`. */
function IllegalRing({
  cx,
  cy,
  r,
  fading,
}: {
  cx: number;
  cy: number;
  r: number;
  fading: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const [fade] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!fading) {
      fade.setValue(1);
      return;
    }
    if (reduceMotion) return;
    const animation = Animated.timing(fade, {
      toValue: 0,
      duration: motion.illegalFade,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [fading, reduceMotion, fade]);
  return (
    <AnimatedCircle
      testID="board-illegal-ring"
      cx={cx}
      cy={cy}
      r={r}
      fill={color.error}
      fillOpacity={opacity.illegalFill}
      stroke={color.error}
      strokeWidth={ILLEGAL_RING_WIDTH}
      strokeDasharray="4,3"
      opacity={fade}
    />
  );
}

/** "E5" pill, max(2.25 cell, 56 px) above the point; beside it when it would leave the board. */
function CoordinateTag({ g, point }: { g: BoardGeometry; point: Point }) {
  const c = pointToLocation(g, point);
  const text = vertexLabel(point, g.size);
  const w = Math.max(TAG_MIN_WIDTH, text.length * 8 + 12);
  const offset = Math.max(2.25 * g.cell, 56);
  let cx = c.x;
  let cy = c.y - offset;
  if (cy - TAG_HEIGHT / 2 < 0) {
    cy = c.y;
    cx = point.x >= g.size / 2 ? c.x - offset : c.x + offset;
  }
  return (
    <>
      <Rect
        testID="board-coord-tag"
        x={cx - w / 2}
        y={cy - TAG_HEIGHT / 2}
        width={w}
        height={TAG_HEIGHT}
        rx={TAG_HEIGHT / 2}
        fill={color.surface}
        stroke={color.border}
        strokeWidth={1}
      />
      <SvgText
        testID="board-coord-tag-text"
        x={cx}
        y={cy + 13 * 0.35}
        fontSize={13}
        fontWeight="600"
        textAnchor="middle"
        fill={color.accent}
      >
        {text}
      </SvgText>
    </>
  );
}

/** One invisible accessible element per intersection; rendered only while a screen reader is on. */
function PointsLayer({
  g,
  stones,
  lastMove,
  markers,
  highlights,
  interactive,
  disabled,
  onActivate,
}: {
  g: BoardGeometry;
  stones: readonly (Color | null)[];
  lastMove: Point | null;
  markers: readonly Marker[];
  highlights: readonly Highlight[];
  interactive: boolean;
  disabled: boolean;
  onActivate: (p: Point) => void;
}) {
  const { t } = useTranslation();
  const playable = interactive && !disabled;
  const separator = t('board.a11y.separator');
  const items: React.ReactElement[] = [];
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      const p = { x, y };
      const v = vertexLabel(p, g.size);
      const content = stones[y * g.size + x];
      const parts = [
        t(`board.a11y.point.${content === 'B' ? 'black' : content === 'W' ? 'white' : 'empty'}`, {
          vertex: v,
        }),
      ];
      if (samePoint(lastMove, p)) parts.push(t('board.a11y.lastMove'));
      for (const m of markers) {
        if (!samePoint(m.point, p)) continue;
        parts.push(
          m.kind === 'label'
            ? t('board.a11y.marker.label', { text: m.text })
            : t(`board.a11y.marker.${m.kind}`),
        );
      }
      for (const h of highlights) {
        if (h.points.some((q) => samePoint(q, p))) parts.push(t(`board.a11y.highlight.${h.kind}`));
      }
      const c = pointToLocation(g, p);
      const style = {
        position: 'absolute',
        left: c.x - g.cell / 2,
        top: c.y - g.cell / 2,
        width: g.cell,
        height: g.cell,
      } as const;
      const common = {
        testID: `board-point-${v.toLowerCase()}`,
        accessible: true,
        accessibilityLabel: parts.join(separator),
        style,
      };
      items.push(
        playable ? (
          <Pressable
            key={v}
            {...common}
            accessibilityRole="button"
            accessibilityHint={t('board.a11y.playHint')}
            onPress={() => onActivate(p)}
          />
        ) : (
          <View key={v} {...common} />
        ),
      );
    }
  }
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {items}
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
  touch: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  touchWeb: { touchAction: 'none', cursor: 'pointer' } as object,
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
