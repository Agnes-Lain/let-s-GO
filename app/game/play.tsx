import { useLocalSearchParams, useRouter } from 'expo-router';

import { useGoHome } from '@/exercises/navigation';
import { parseLevel } from '@/game9/levelParam';
import { GameScreen } from '@/game9/ui/GameScreen';
import { Screen } from '@/theme/Screen';

/** A 9×9 game against the bot (spec M6 §5.2). UI only: the rules live in src/game9. */
export default function GamePlayScreen() {
  const { level } = useLocalSearchParams<{ level?: string }>();
  const router = useRouter();
  const goHome = useGoHome();
  const botLevel = parseLevel(level);
  return (
    <Screen>
      <GameScreen
        key={botLevel}
        level={botLevel}
        onLeave={goHome}
        onChangeLevel={() => router.replace('/game')}
      />
    </Screen>
  );
}
