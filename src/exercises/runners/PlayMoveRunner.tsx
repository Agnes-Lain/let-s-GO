// play-move (spec §6.4): the learner plays a stone; the engine plays it and the goal is judged.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GoBoard, type CaptureEvent } from '@/board';
import { type GameState, type IllegalReason, type Point } from '@/engine';
import { getSolution, toStepMarkers, type PlayMoveExercise } from '@/lessons';

import { checkExerciseMove, exerciseGame, judgePlayMove } from '../engineAdapter';
import { ExerciseFrame } from '../ExerciseFrame';
import { illegalFeedback } from '../feedback';
import { highlight, hintHighlight, type RunnerProps } from './types';

interface Played {
  state: GameState;
  move: Point;
  capture: CaptureEvent | null;
}

export function PlayMoveRunner({
  exercise,
  coordinates,
  boardWidth,
  attempts,
  dispatch,
  feedback,
  next,
}: RunnerProps<PlayMoveExercise>) {
  const { t } = useTranslation();
  const { size } = exercise;
  const start = useMemo(() => exerciseGame(exercise), [exercise]);
  const markers = useMemo(() => toStepMarkers(exercise.markers, size), [exercise, size]);
  const active = attempts.status === 'active';
  const revealed = attempts.status === 'revealed';

  const [played, setPlayed] = useState<Played | null>(null);
  /** After a wrong move the board waits for *Try again*. */
  const [locked, setLocked] = useState(false);
  const [moveCount, setMoveCount] = useState(0);

  // The answer is shown on the setup position, never played (AC 79).
  const shown = revealed ? null : played;
  const state = shown?.state ?? start;

  const onPlay = (p: Point) => {
    if (!active || locked) return;
    const judgement = judgePlayMove(exercise, state, p);
    if (judgement.kind === 'illegal') {
      dispatch({ type: 'info', lines: illegalFeedback(judgement.reason) });
      return;
    }
    const id = moveCount + 1;
    setMoveCount(id);
    const captured = judgement.facts.captured.flat();
    setPlayed({
      state: judgement.state,
      move: judgement.facts.point,
      capture:
        captured.length > 0
          ? { id, color: exercise.toPlay === 'B' ? 'W' : 'B', points: captured }
          : null,
    });
    if (judgement.correct) {
      dispatch({ type: 'correct' });
    } else {
      setLocked(true);
      dispatch({ type: 'wrong', lines: judgement.lines });
    }
  };

  const onIllegal = (_p: Point, reason: IllegalReason) => {
    if (active && !locked) dispatch({ type: 'info', lines: illegalFeedback(reason) });
  };

  const tryAgain = () => {
    setPlayed(null);
    setLocked(false);
    dispatch({ type: 'clear' });
  };

  const highlights = [
    ...(active && locked && shown ? [{ kind: 'error' as const, points: [shown.move] }] : []),
    ...highlight('success', revealed ? getSolution(exercise).points : [], size),
    ...hintHighlight(exercise, attempts),
  ];

  const action = !active
    ? next
    : locked
      ? { label: t('practice.tryAgain'), onPress: tryAgain, testID: 'practice-try-again' }
      : null;

  return (
    <ExerciseFrame feedback={feedback} action={action}>
      <GoBoard
        size={size}
        stones={state.board.cells}
        width={boardWidth}
        showCoordinates={coordinates}
        interactive
        disabled={!active || locked}
        playerColor={exercise.toPlay}
        checkPoint={(p) => checkExerciseMove(state, p)}
        onPlay={onPlay}
        onIllegal={onIllegal}
        lastMove={shown?.move ?? null}
        lastCapture={shown?.capture ?? null}
        highlights={highlights}
        markers={markers}
        testID="practice-board"
      />
    </ExerciseFrame>
  );
}
