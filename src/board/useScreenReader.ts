import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True while a screen reader (VoiceOver / TalkBack) is on. False until the OS answers. */
export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
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
