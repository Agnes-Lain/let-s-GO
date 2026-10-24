import { useRouter } from 'expo-router';

import { LEARN_ROUTE } from '@/exercises/navigation';
import { Landing } from '@/home/Landing';
import { progressStore, shouldShowOnboarding } from '@/store';

/**
 * Landing page `/` (M6-settings §12c.1, 3, 4): shown on every launch, never redirected. "Start
 * learning" opens the intro the first time (no intro seen, no progress), else the learning page.
 */
export default function LandingScreen() {
  const router = useRouter();
  const start = () => {
    // The start-up cover keeps touches away until progress is read (or the 1 s cap has passed).
    const firstTime = shouldShowOnboarding({ ...progressStore.getState(), hydrated: true });
    router.push(firstTime ? '/onboarding' : LEARN_ROUTE);
  };
  return <Landing onStart={start} onOpenSettings={() => router.push('/settings')} />;
}
