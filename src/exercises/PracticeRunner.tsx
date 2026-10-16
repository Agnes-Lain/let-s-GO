// A practice set (spec §6.3–6.6): exercises in order, then the result. Records once, at the end.
import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

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
  const navigation = useNavigation();
  const [run, setRun] = useState(0);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [leaving, setLeaving] = useState(false);
  /** Set right before a deliberate exit, so the back guard lets it through. */
  const allowExit = useRef(false);

  // ✕, Android back and the iOS back gesture open the leave sheet mid-set (spec §6.5, Q10).
  const inSet = finished === null;
  useEffect(() => {
    if (!inSet) return;
    return navigation.addListener('beforeRemove', (event) => {
      if (allowExit.current) return;
      event.preventDefault();
      setLeaving(true);
    });
  }, [navigation, inSet]);

  const exit = (go: () => void) => {
    allowExit.current = true;
    setLeaving(false);
    go();
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
      <LeaveSheet visible={leaving} onStay={() => setLeaving(false)} onLeave={() => exit(onExit)} />
    </>
  );
}
