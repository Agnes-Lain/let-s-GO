import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useSettings } from '@/store';

/** The phone's reduce-motion setting: null until the OS answers. */
export function useOsReduceMotion(): boolean | null {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (active) setReduce(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

/**
 * True when the OS asks for reduced motion or the app's Settings switch is on (M6-settings AC 11).
 * Assumes true until the OS answers, so motion never starts by mistake.
 */
export function useReduceMotion(): boolean {
  const os = useOsReduceMotion();
  const app = useSettings((s) => s.reduceMotion);
  return os !== false || app;
}
