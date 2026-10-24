import { useLocalSearchParams, useRouter } from 'expo-router';

import { useGoToLearning } from '@/exercises/navigation';
import { parseConfirm, parseHandicap, parseLevel, parseSize } from '@/game9/levelParam';
import { GameScreen } from '@/game9/ui/GameScreen';
import { Screen } from '@/theme/Screen';

/** A 9×9 or 13×13 game against the bot (spec M6 §5.2, M6b §5.2). UI only: rules in src/game9. */
export default function GamePlayScreen() {
  const { level, handicap, size, confirm } = useLocalSearchParams<{
    level?: string;
    handicap?: string;
    size?: string;
    confirm?: string;
  }>();
  const router = useRouter();
  const goHome = useGoToLearning();
  const botLevel = parseLevel(level);
  const stones = parseHandicap(handicap);
  const boardSize = parseSize(size);
  return (
    <Screen>
      <GameScreen
        key={`${boardSize}-${botLevel}-${stones}`}
        size={boardSize}
        level={botLevel}
        handicap={stones}
        confirmMoves={boardSize === 13 && parseConfirm(confirm)}
        onLeave={goHome}
        onChangeLevel={() => router.replace('/game')}
      />
    </Screen>
  );
}
