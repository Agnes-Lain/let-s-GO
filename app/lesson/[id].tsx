import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PlaceholderBody } from '@/theme/PlaceholderBody';
import { Screen, TopBar } from '@/theme/Screen';

export default function LessonPlaceholderScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <TopBar showBack title={t('placeholder.lesson.title')} />
      <PlaceholderBody
        title={t('placeholder.lesson.title')}
        id={id}
        body={t('placeholder.comingSoon')}
      />
    </Screen>
  );
}
