import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * True while a screen reader (VoiceOver / TalkBack) is on. False until the OS answers.
 * Always false on web: react-native-web's `isScreenReaderEnabled()` resolves `true` in every
 * browser (it cannot detect one), which would put the per-point accessibility layer over the touch
 * overlay and kill the touch preview. On web the board's root label is used instead.
 */
export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled?.()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('screenReaderChanged', setEnabled);
    return () => {
      active = false;
      sub?.remove();
    };
  }, []);
  return enabled;
}
