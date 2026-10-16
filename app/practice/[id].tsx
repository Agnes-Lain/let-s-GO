import { useLocalSearchParams, useRouter } from 'expo-router';

import { LessonMessage } from '@/exercises/LessonMessage';
import { useGoHome } from '@/exercises/navigation';
import { PracticeRunner } from '@/exercises/PracticeRunner';
import { useLessonGate } from '@/exercises/useLessonGate';
import { Screen } from '@/theme/Screen';

/** Practice set route (spec §6.3–6.6). UI only: runners and rules live in src/exercises. */
export default function PracticeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goHome = useGoHome();
  const gate = useLessonGate(id);

  if (gate.status !== 'ok') return <LessonMessage status={gate.status} />;
  const { lesson } = gate;
  return (
    <Screen>
      <PracticeRunner
        key={lesson.id}
        lesson={lesson}
        onExit={goHome}
        onOpenLesson={(next) => router.replace(`/lesson/${next}`)}
        onReview={() => router.replace(`/lesson/${lesson.id}`)}
      />
    </Screen>
  );
}
