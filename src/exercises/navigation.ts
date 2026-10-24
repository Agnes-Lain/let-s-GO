import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/** The learning page: modules, Continue card, 9×9 card (M6-settings §12c.2). */
export const LEARN_ROUTE = '/learn';
/** The landing page (M6-settings §12c.1). */
export const LANDING_ROUTE = '/';

/** Pops back to `href` when it is in the history, otherwise replaces the screen with it. */
function useReturnTo(href: typeof LEARN_ROUTE | typeof LANDING_ROUTE) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.dismissTo(href);
    else router.replace(href);
  }, [router, href]);
}

/** Back to the map: lessons, results and the 9×9 game return to the learning page (§12c.2). */
export function useGoToLearning() {
  return useReturnTo(LEARN_ROUTE);
}

/** Back from the learning page to the landing page (§12c.5). */
export function useGoToLanding() {
  return useReturnTo(LANDING_ROUTE);
}
