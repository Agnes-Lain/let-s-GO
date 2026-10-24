import { useLocalSearchParams, useRouter } from 'expo-router';

import { useGoToLearning } from '@/exercises/navigation';
import { parseSize, playUrl } from '@/game9/levelParam';
import { LevelPicker } from '@/game9/ui/LevelPicker';
import { Screen } from '@/theme/Screen';

/**
 * The level picker (spec M6 §5.1; M6-beginner-friendly §5.1; M6b §13): the board size comes from
 * the route (`/game` = 9×9, `/game?size=13` from the 13×13 card); choose a level and a handicap,
 * then Start. Back returns to the learning page (M6-settings §12c.2).
 */
export default function GamePickerScreen() {
  const router = useRouter();
  const backToMap = useGoToLearning();
  const { size } = useLocalSearchParams<{ size?: string }>();
  const boardSize = parseSize(size);
  return (
    <Screen>
      <LevelPicker
        key={boardSize}
        size={boardSize}
        onBack={backToMap}
        onPick={(pick) => router.push(playUrl(pick))}
      />
    </Screen>
  );
}
