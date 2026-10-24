import { useRouter } from 'expo-router';

import { useGoToLearning } from '@/exercises/navigation';
import { playUrl } from '@/game9/levelParam';
import { LevelPicker } from '@/game9/ui/LevelPicker';
import { Screen } from '@/theme/Screen';

/**
 * The level picker (spec M6 §5.1; M6-beginner-friendly §5.1; M6b §5.1): choose a board size, a
 * level and a handicap, then Start. Back returns to the learning page (M6-settings §12c.2).
 */
export default function GamePickerScreen() {
  const router = useRouter();
  const backToMap = useGoToLearning();
  return (
    <Screen>
      <LevelPicker onBack={backToMap} onPick={(pick) => router.push(playUrl(pick))} />
    </Screen>
  );
}
