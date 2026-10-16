import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/** Back to the map: pops to Home when it is in the history, otherwise replaces the screen. */
export function useGoHome() {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.dismissTo('/');
    else router.replace('/');
  }, [router]);
}
