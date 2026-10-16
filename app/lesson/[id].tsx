import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { ExplainPlayer } from '@/exercises/ExplainPlayer';
import { LessonMessage } from '@/exercises/LessonMessage';
import { useGoHome } from '@/exercises/navigation';
import { useLessonGate } from '@/exercises/useLessonGate';

/** Explanation player route (spec §6.2). UI only: the lesson data drives everything. */
export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goHome = useGoHome();
  const gate = useLessonGate(id);

  if (gate.status !== 'ok') return <LessonMessage status={gate.status} />;
  const { lesson } = gate;
  if ((lesson.explain ?? []).length === 0) {
    // A checkpoint has no explanation: go straight to the practice set.
    return <Redirect href={`/practice/${lesson.id}`} />;
  }
  return (
    <ExplainPlayer
      lesson={lesson}
      stars={gate.stars}
      onClose={goHome}
      onStartPractice={() => router.push(`/practice/${lesson.id}`)}
    />
  );
}
