import { useMemo } from 'react';

import { getUnits, isLessonUnlocked, loadLesson, type Lesson } from '@/lessons';
import { useProgress } from '@/store';

export type LessonGate =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'locked' }
  | { status: 'ok'; lesson: Lesson; stars: number };

/**
 * Loads a lesson for a screen and checks that it may be opened (spec §6.7): unknown or invalid →
 * error; locked by progress → locked; storage not read yet → loading.
 */
export function useLessonGate(id: string | undefined): LessonGate {
  const hydrated = useProgress((s) => s.hydrated);
  const lessons = useProgress((s) => s.lessons);
  const loaded = useMemo(() => (id ? loadLesson(id) : null), [id]);
  return useMemo((): LessonGate => {
    if (!loaded?.ok) return { status: 'error' };
    if (!hydrated) return { status: 'loading' };
    if (!isLessonUnlocked(getUnits(), lessons, loaded.lesson)) return { status: 'locked' };
    return { status: 'ok', lesson: loaded.lesson, stars: lessons[loaded.lesson.id]?.stars ?? 0 };
  }, [loaded, hydrated, lessons]);
}
