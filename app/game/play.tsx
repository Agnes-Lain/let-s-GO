import { useLocalSearchParams, useRouter } from 'expo-router';

import { useGoToLearning } from '@/exercises/navigation';
import { parseHandicap, parseLevel } from '@/game9/levelParam';
import { GameScreen } from '@/game9/ui/GameScreen';
import { Screen } from '@/theme/Screen';

/** A 9×9 game against the bot (spec M6 §5.2). UI only: the rules live in src/game9. */
export default function GamePlayScreen() {
  const { level, handicap } = useLocalSearchParams<{ level?: string; handicap?: string }>();
  const router = useRouter();
  const goHome = useGoToLearning();
  const botLevel = parseLevel(level);
  const stones = parseHandicap(handicap);
  return (
    <Screen>
      <GameScreen
        key={`${botLevel}-${stones}`}
        level={botLevel}
        handicap={stones}
        onLeave={goHome}
        onChangeLevel={() => router.replace('/game')}
      />
    </Screen>
  );
}
