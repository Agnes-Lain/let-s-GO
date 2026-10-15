import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PlaceholderBody } from '@/theme/PlaceholderBody';
import { Screen, TopBar } from '@/theme/Screen';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <TopBar />
      <PlaceholderBody
        title={t('notFound.title')}
        action={{ label: t('notFound.home'), onPress: () => router.replace('/') }}
      />
    </Screen>
  );
}
