// Settings screen (docs/specs/M6-settings-onboarding-a11y.md §4.3, §5.1): AC 10, 12, 16–22, 4.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router as appRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, Modal, StyleSheet } from 'react-native';

import { isSoundEnabled } from '@/board/soundSetting';
import { setLanguageChoice } from '@/i18n';
import en from '@/i18n/en.json';
import { PROGRESS_KEY, SETTINGS_KEY, progressStore, settingsStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

const texts = en as Record<string, string>;
const hidden = { includeHiddenElements: true };
const settle = () => act(async () => {});
const press = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};
const checked = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.checked;
const SIX = Array(6).fill('clean') as 'clean'[];

function osReduceMotion(value: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(value);
}

async function openSettings() {
  const router = await renderRouter('./app', { initialUrl: '/' });
  await settle();
  await act(() => appRouter.push('/settings'));
  await settle();
  return router;
}

/** Every text on the screen in render order. */
function textsInOrder(): string[] {
  return screen.UNSAFE_root.findAll((node) => (node.type as unknown) === 'Text').map((node) =>
    [node.props.children].flat().join(''),
  );
}

beforeEach(async () => {
  osReduceMotion(false);
  progressStore.getState().reset();
  progressStore.getState().setFlag('onboardingSeen');
  act(() => {
    settingsStore.getState().setSound(true);
    settingsStore.getState().setReduceMotion(false);
  });
  await act(() => setLanguageChoice('en'));
});
afterEach(async () => {
  jest.restoreAllMocks();
  act(() => {
    settingsStore.getState().setSound(true);
    settingsStore.getState().setReduceMotion(false);
  });
  await act(() => setLanguageChoice('system'));
});

describe('layout (AC 16, 19)', () => {
  it('AC 16: Language, Sound and motion, Games, Help, Progress, dev row, then Version', async () => {
    await openSettings();
    const order = textsInOrder();
    const at = (text: string) => {
      const i = order.findIndex((t) => t.startsWith(text));
      expect({ text, found: i >= 0 }).toEqual({ text, found: true });
      return i;
    };
    const sequence = [
      texts['settings.language'],
      texts['settings.language.system'],
      texts['settings.section.sound'],
      texts['settings.sound'],
      texts['settings.motion'],
      texts['settings.section.games'],
      texts['game9.picker.atariHints'],
      texts['settings.section.help'],
      texts['settings.intro'],
      texts['settings.section.progress'],
      texts['settings.reset'],
      texts['dev.board.open'], // __DEV__ is true in Jest: the dev row stays after Progress
      texts['settings.version'],
    ].map(at);
    expect(sequence).toEqual([...sequence].sort((a, b) => a - b));
  });

  it('AC 19: no handicap control in Settings', async () => {
    await openSettings();
    expect(screen.queryByText(texts['game9.picker.handicap'])).toBeNull();
    expect(screen.queryAllByTestId(/handicap/)).toHaveLength(0);
  });

  it('the page scrolls (AC 23, 42)', async () => {
    await openSettings();
    expect(screen.getByTestId('settings-scroll').type).toBe('RCTScrollView');
  });
});

describe('switch rows (AC 17, 10)', () => {
  it.each([
    ['settings-sound', 'settings.sound', 'settings.sound.desc'],
    ['settings-motion', 'settings.motion', 'settings.motion.desc'],
    ['settings-atari', 'game9.picker.atariHints', 'game9.picker.atariHintsDesc'],
  ])('AC 17: %s is one switch row ≥ 52 high with label and hint', async (id, label, hint) => {
    await openSettings();
    const row = screen.getByTestId(id);
    expect(row.props.accessibilityRole).toBe('switch');
    expect(row.props.accessibilityLabel).toBe(texts[label]);
    expect(row.props.accessibilityHint).toBe(texts[hint]);
    expect(typeof row.props.accessibilityState.checked).toBe('boolean');
    expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(52);
    // The drawn track is decorative.
    expect(screen.getByTestId(`${id}-track`, hidden).props['aria-hidden']).toBe(true);
  });

  it('AC 10: Stone sound off takes effect at once (no restart) and is saved', async () => {
    await openSettings();
    expect(checked('settings-sound')).toBe(true);
    expect(isSoundEnabled()).toBe(true);
    await press('settings-sound');
    expect(checked('settings-sound')).toBe(false);
    expect(settingsStore.getState().sound).toBe(false);
    expect(isSoundEnabled()).toBe(false);
    const saved = JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) as string);
    expect(saved).toMatchObject({ v: 1, sound: false });
    await press('settings-sound');
    expect(isSoundEnabled()).toBe(true);
  });

  it('Reduce motion: the app switch toggles and is saved (OS off)', async () => {
    await openSettings();
    expect(checked('settings-motion')).toBe(false);
    await press('settings-motion');
    expect(checked('settings-motion')).toBe(true);
    expect(settingsStore.getState().reduceMotion).toBe(true);
    expect(screen.queryByTestId('settings-motion-note')).toBeNull();
  });

  it('AC 12: OS reduce-motion on → checked, disabled, the osOn line; pressing changes nothing', async () => {
    osReduceMotion(true);
    await openSettings();
    const row = screen.getByTestId('settings-motion');
    expect(row.props.accessibilityState).toMatchObject({ checked: true, disabled: true });
    expect(screen.getByText(texts['settings.motion.osOn'])).toBeOnTheScreen();
    await press('settings-motion');
    expect(settingsStore.getState().reduceMotion).toBe(false);
    expect(checked('settings-motion')).toBe(true);
  });

  it('AC 4 (UI): picking Français saves it in the settings key', async () => {
    await openSettings();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Français' }));
    });
    const saved = JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) as string);
    expect(saved.language).toBe('fr');
    expect(screen.getByText('Réglages')).toBeOnTheScreen();
  });
});

describe('Atari warnings (AC 18)', () => {
  it('Settings writes flags.atariHintsOff (inverted) and the picker shows the same', async () => {
    await openSettings();
    expect(checked('settings-atari')).toBe(true);
    await press('settings-atari');
    expect(progressStore.getState().flags.atariHintsOff).toBe(true);
    await act(() => appRouter.push('/game'));
    await settle();
    expect(checked('game9-atari-hints')).toBe(false);
    await press('game9-atari-hints');
    expect(progressStore.getState().flags.atariHintsOff).toBeUndefined();
    await act(() => appRouter.back());
    await settle();
    expect(checked('settings-atari')).toBe(true);
  });
});

describe('Erase progress (AC 20–22)', () => {
  function seed() {
    act(() => {
      progressStore.getState().record('u01-board', SIX);
      progressStore.getState().recordGame(1, 'loss', 2);
      for (const flag of [
        'passExplained',
        'easierTipShown',
        'takebackExplained',
        'atariHintsOff',
      ] as const) {
        progressStore.getState().setFlag(flag);
      }
    });
  }

  it('AC 20, 22: the row opens the sheet; nothing is erased yet; Keep is first and primary', async () => {
    seed();
    await openSettings();
    const row = screen.getByTestId('settings-reset');
    expect(row.props.accessibilityRole).toBe('button');
    await press('settings-reset');
    const sheet = screen.getByTestId('settings-reset-sheet');
    expect(sheet.props.accessibilityViewIsModal).toBe(true);
    expect(screen.getByText(texts['settings.reset.title'])).toBeOnTheScreen();
    expect(screen.getByText(texts['settings.reset.body'])).toBeOnTheScreen();
    const buttons = screen
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel)
      .filter((l) => l === texts['settings.reset.keep'] || l === texts['settings.reset.confirm']);
    expect(buttons).toEqual([texts['settings.reset.keep'], texts['settings.reset.confirm']]);
    const keepStyle = StyleSheet.flatten(screen.getByTestId('settings-reset-keep').props.style);
    expect(keepStyle.backgroundColor).toBe('#3E6461'); // color.accent: primary
    expect(progressStore.getState().lessons['u01-board']).toBeDefined();
  });

  it('AC 20: Keep, Android back and the dim area close the sheet without erasing', async () => {
    seed();
    await openSettings();
    await press('settings-reset');
    await press('settings-reset-keep');
    expect(screen.queryByTestId('settings-reset-sheet')).toBeNull();
    await press('settings-reset');
    await act(async () => {
      screen.UNSAFE_getByType(Modal).props.onRequestClose();
    });
    expect(screen.queryByTestId('settings-reset-sheet')).toBeNull();
    await press('settings-reset');
    await act(async () => {
      fireEvent.press(screen.getByTestId('settings-reset-sheet-dismiss', hidden));
    });
    expect(screen.queryByTestId('settings-reset-sheet')).toBeNull();
    expect(progressStore.getState().lessons['u01-board']).toBeDefined();
    expect(progressStore.getState().bots['1']).toBeDefined();
  });

  it('AC 21: Erase clears lessons, bots and tips; keeps atariHintsOff, onboardingSeen and settings', async () => {
    seed();
    act(() => settingsStore.getState().setSound(false));
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const router = await openSettings();
    await press('settings-reset');
    await press('settings-reset-confirm');
    const state = progressStore.getState();
    expect(state.lessons).toEqual({});
    expect(state.bots).toEqual({});
    expect(state.flags).toEqual({ atariHintsOff: true, onboardingSeen: true });
    const raw = JSON.parse((await AsyncStorage.getItem(PROGRESS_KEY)) as string);
    expect(raw).toEqual({
      v: 1,
      lessons: {},
      flags: { atariHintsOff: true, onboardingSeen: true },
    });
    expect(settingsStore.getState().sound).toBe(false);
    expect(screen.queryByTestId('settings-reset-sheet')).toBeNull();
    const done = screen.getByTestId('settings-reset-done');
    expect(done).toHaveTextContent(texts['settings.reset.done']);
    expect(done.props.accessibilityLiveRegion).toBe('polite');
    expect(announce).toHaveBeenCalledWith(texts['settings.reset.done']);
    // Home: lesson 1 is the Continue card with 0 stars; no intro (onboardingSeen kept).
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: texts['common.back'] }));
    });
    expect(router.getPathname()).toBe('/');
    expect(screen.getByTestId('home-continue').props.accessibilityLabel).toBe(
      'Start learning, Unit 1 · Board & stones · 棋盘 qípán',
    );
    expect(screen.getByTestId('home-node-unit-1').props.accessibilityLabel).toBe(
      'Unit 1, Board & stones · 棋盘 qípán, not started',
    );
  });
});

describe('Help (§5.4)', () => {
  it('"Show the intro again" opens the intro in replay mode', async () => {
    const router = await openSettings();
    await press('settings-intro');
    expect(router.getPathname()).toBe('/onboarding');
    expect(router.getSearchParams()).toMatchObject({ replay: '1' });
  });
});
