import { useRouter } from 'expo-router';

import { LevelPicker } from '@/game9/ui/LevelPicker';
import { Screen } from '@/theme/Screen';

/**
 * The level picker (spec M6 §5.1; M6-beginner-friendly §5.1): choose a level and a handicap,
 * then Start.
 */
export default function GamePickerScreen() {
  const router = useRouter();
  return (
    <Screen>
      <LevelPicker
        onPick={(level, handicap) => router.push(`/game/play?level=${level}&handicap=${handicap}`)}
      />
    </Screen>
  );
}
