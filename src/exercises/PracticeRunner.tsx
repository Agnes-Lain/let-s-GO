// A practice set (spec §6.3–6.6): exercises in order, then the result. Records once, at the end.
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getUnits, type Lesson, type MapNode, type Outcome } from '@/lessons';
import { progressStore, type RecordResult } from '@/store';

import { ExerciseView } from './ExerciseView';
import { LeaveSheet } from './LeaveSheet';
import { nodeAfter } from './nextNode';
import { ResultView } from './ResultView';

type Props = {
  lesson: Lesson;
  onExit: () => void;
  onOpenLesson: (lessonId: string) => void;
  onReview: () => void;
};

interface Finished {
  outcomes: Outcome[];
  result: RecordResult;
  next: MapNode | null;
}

export function PracticeRunner({ lesson, onExit, onOpenLesson, onReview }: Props) {
  const [run, setRun] = useState(0);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [leaving, setLeaving] = useState(false);
  /** A deliberate exit is under way: the back guard is lifted, then `pendingExit` runs. */
  const [exiting, setExiting] = useState(false);
  const pendingExit = useRef<{ go: () => void; afterSheet: boolean } | null>(null);

  // ✕, Android back and the iOS back gesture open the leave sheet mid-set (spec §6.5, Q10).
  // usePreventRemove (not a raw 'beforeRemove' listener) also tells the native stack to cancel
  // the iOS swipe, so the screen bounces back instead of leaving JS and native state out of sync.
  // Back while the sheet is open closes it, like the sheet's own onRequestClose.
  usePreventRemove(finished === null && !exiting, () => setLeaving((open) => !open));

  const runPendingExit = useCallback(() => {
    const pending = pendingExit.current;
    pendingExit.current = null;
    pending?.go();
  }, []);

  // Navigate once the guard is lifted (after this re-render). When the sheet was open, wait for
  // it to finish closing (LeaveSheet onDismissed): iOS ignores a stack pop while a modal is still
  // dismissing. The timer is a fallback for platforms that never report the dismissal.
  useEffect(() => {
    if (!exiting || !pendingExit.current) return;
    if (!pendingExit.current.afterSheet) {
      runPendingExit();
      return;
    }
    const timer = setTimeout(runPendingExit, 600);
    return () => clearTimeout(timer);
  }, [exiting, runPendingExit]);

  const exit = (go: () => void) => {
    pendingExit.current = { go, afterSheet: leaving };
    setLeaving(false);
    setExiting(true);
  };

  const onDone = (outcome: Outcome) => {
    const all = [...outcomes, outcome];
    if (all.length < lesson.exercises.length) {
      setOutcomes(all);
      setIndex(all.length);
      return;
    }
    // Recorded here, in the event handler: re-renders never record again (AC 66).
    const result = progressStore.getState().record(lesson.id, all);
    const next = nodeAfter(getUnits(), progressStore.getState().lessons, lesson.id);
    setOutcomes(all);
    setFinished({ outcomes: all, result, next });
  };

  const restart = () => {
    setFinished(null);
    setOutcomes([]);
    setIndex(0);
    setRun((r) => r + 1);
  };

  if (finished) {
    return (
      <ResultView
        outcomes={finished.outcomes}
        result={finished.result}
        games={lesson.exercises.every((e) => e.type === 'play-bot')}
        hasNext={finished.next !== null}
        onNext={() => finished.next && exit(() => onOpenLesson(finished.next!.lesson.id))}
        onAgain={restart}
        onReview={() => exit(onReview)}
        onMap={() => exit(onExit)}
      />
    );
  }

  return (
    <>
      <ExerciseView
        key={`${run}-${index}`}
        lesson={lesson}
        index={index}
        onClose={() => setLeaving(true)}
        onDone={onDone}
      />
      <LeaveSheet
        visible={leaving}
        onStay={() => setLeaving(false)}
        onLeave={() => exit(onExit)}
        onDismissed={runPendingExit}
      />
    </>
  );
}
