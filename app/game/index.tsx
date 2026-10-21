import { useRouter } from 'expo-router';

import { LevelPicker } from '@/game9/ui/LevelPicker';
import { Screen } from '@/theme/Screen';

/** The level picker (spec M6 §5.1). Tapping a level starts the game at once (AC 15). */
export default function GamePickerScreen() {
  const router = useRouter();
  return (
    <Screen>
      <LevelPicker onPick={(level) => router.push(`/game/play?level=${level}`)} />
    </Screen>
  );
}
