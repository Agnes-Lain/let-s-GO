// tap-point (spec §6.4): 'one' judges the first tap; 'all' toggles points, then *Check*.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GoBoard } from '@/board';
import { toVertex, type Point, type Vertex } from '@/engine';
import {
  getSolution,
  lastPlayedPoint,
  startState,
  toStepMarkers,
  type TapPointExercise,
} from '@/lessons';

import { ExerciseFrame } from '../ExerciseFrame';
import { tapAllFeedback } from '../feedback';
import { judgeTapAll } from '../judge';
import { FLASH_MS, highlight, hintHighlight, type RunnerProps } from './types';

const ALWAYS_LEGAL = () => ({ legal: true }) as const;

export function TapPointRunner({
  exercise,
  coordinates,
  boardWidth,
  attempts,
  dispatch,
  feedback,
  next,
}: RunnerProps<TapPointExercise>) {
  const { t } = useTranslation();
  const { size } = exercise;
  const start = useMemo(() => startState(exercise), [exercise]);
  const stones = start.board.cells;
  // A prelude's last move keeps the normal last-move mark (spec M5 AC 12).
  const lastMove = useMemo(() => lastPlayedPoint(start), [start]);
  const markers = useMemo(() => toStepMarkers(exercise.markers, size), [exercise, size]);
  const answer = useMemo(() => getSolution(exercise).points, [exercise]);
  const active = attempts.status === 'active';

  const [selected, setSelected] = useState<Vertex[]>([]);
  const [tapped, setTapped] = useState<Vertex | null>(null);
  const [flash, setFlash] = useState<Vertex[]>([]);
  useEffect(() => {
    if (flash.length === 0) return;
    const timer = setTimeout(() => setFlash([]), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  const onPlay = (p: Point) => {
    if (!active) return;
    const v = toVertex(p, size);
    if (exercise.mode === 'all') {
      setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
      return;
    }
    setTapped(v);
    if (answer.includes(v)) {
      dispatch({ type: 'correct' });
    } else {
      setFlash([v]);
      dispatch({ type: 'wrong', lines: [{ key: 'fb.tapOne.wrong' }] });
    }
  };

  const check = () => {
    const result = judgeTapAll(selected, answer);
    if (result.correct) {
      dispatch({ type: 'correct' });
      return;
    }
    setSelected(result.found);
    setFlash(result.extra);
    dispatch({
      type: 'wrong',
      lines: tapAllFeedback(result.found.length, answer.length, result.extra.length),
    });
  };

  const correctPoints =
    attempts.status === 'revealed'
      ? answer
      : attempts.status === 'correct'
        ? exercise.mode === 'one' && tapped
          ? [tapped]
          : answer
        : [];
  const highlights = [
    ...highlight('liberty', active && exercise.mode === 'all' ? selected : [], size),
    ...highlight('error', active ? flash : [], size),
    ...highlight('success', correctPoints, size),
    ...hintHighlight(exercise, attempts),
  ];

  const action = !active
    ? next
    : exercise.mode === 'all'
      ? {
          label: t('practice.check'),
          onPress: check,
          disabled: selected.length === 0,
          testID: 'practice-check',
        }
      : null;

  return (
    <ExerciseFrame feedback={feedback} action={action}>
      <GoBoard
        lastMove={lastMove}
        size={size}
        stones={stones}
        width={boardWidth}
        showCoordinates={coordinates}
        interactive
        disabled={!active}
        pointer="ring"
        checkPoint={ALWAYS_LEGAL}
        onPlay={onPlay}
        highlights={highlights}
        markers={markers}
        sound={false}
        testID="practice-board"
      />
    </ExerciseFrame>
  );
}
