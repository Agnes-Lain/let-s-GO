import { useTranslation } from 'react-i18next';

import { PlaceholderBody } from '@/theme/PlaceholderBody';
import { Screen } from '@/theme/Screen';

import { useGoToLearning } from './navigation';

/** Error / locked / loading states of the lesson and practice screens (spec §6.7). */
export function LessonMessage({ status }: { status: 'loading' | 'error' | 'locked' }) {
  const { t } = useTranslation();
  const goHome = useGoToLearning();
  if (status === 'loading') return <Screen>{null}</Screen>;
  return (
    <Screen>
      <PlaceholderBody
        title={t('error.lesson.title')}
        body={status === 'locked' ? t('error.locked.body') : t('error.lesson.body')}
        action={{ label: t('complete.map'), onPress: goHome }}
      />
    </Screen>
  );
}
