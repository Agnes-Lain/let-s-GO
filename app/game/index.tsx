import { useRouter } from 'expo-router';

import { useGoToLearning } from '@/exercises/navigation';
import { LevelPicker } from '@/game9/ui/LevelPicker';
import { Screen } from '@/theme/Screen';

/**
 * The level picker (spec M6 §5.1; M6-beginner-friendly §5.1): choose a level and a handicap,
 * then Start. Back returns to the learning page (M6-settings §12c.2).
 */
export default function GamePickerScreen() {
  const router = useRouter();
  const backToMap = useGoToLearning();
  return (
    <Screen>
      <LevelPicker
        onBack={backToMap}
        onPick={(level, handicap) => router.push(`/game/play?level=${level}&handicap=${handicap}`)}
      />
    </Screen>
  );
}
