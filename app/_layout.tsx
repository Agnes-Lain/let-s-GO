import '@/i18n';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { setSoundEnabled } from '@/board/soundSetting';
import { settingsStore, useProgress, useSettings } from '@/store';
import { color } from '@/theme/tokens';

/** The longest the start-up cover waits for the saved progress and settings (spec §3). */
export const HYDRATION_CAP_MS = 1000;

// The Stone sound switch gates every stone sound, wired once (spec §3, AC 9–10).
setSoundEnabled(settingsStore.getState().sound);
settingsStore.subscribe((state) => setSoundEnabled(state.sound));

/** True once both stores are read (or after the cap, with the defaults). */
function useStoresReady(): boolean {
  const progress = useProgress((s) => s.hydrated);
  const settings = useSettings((s) => s.hydrated);
  const hydrated = progress && settings;
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    const timer = setTimeout(() => setTimedOut(true), HYDRATION_CAP_MS);
    return () => clearTimeout(timer);
  }, [hydrated]);
  return hydrated || timedOut;
}

export default function RootLayout() {
  const ready = useStoresReady();
  return (
    <>
      <StatusBar style="dark" />
      {/* Until the saved language is read, only the background shows (no wrong-language frame,
          AC 8); the screens mount underneath, hidden from touch and screen readers. */}
      <View style={styles.fill} pointerEvents={ready ? 'auto' : 'none'} aria-hidden={!ready}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.background },
          }}
        />
      </View>
      {ready ? null : <View style={styles.cover} testID="startup-cover" />}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { ...StyleSheet.absoluteFill, backgroundColor: color.background },
});
