// QA edge cases for the §12c flow (landing `/` -> intro -> `/learn`): hardware back, repeated
// presses, replay, and progress states that decide whether the intro shows.
import { router as appRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, BackHandler } from 'react-native';

import { setLanguageChoice } from '@/i18n';
import { progressStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const settle = async () => act(async () => {});
const press = async (testID: string) => {
  await act(async () => {
    await fireEvent.press(screen.getByTestId(testID));
  });
};
let backHandler: (() => boolean | null | undefined) | null = null;
const systemBack = async () =>
  act(async () => {
    backHandler?.();
  });
const launch = async (url = '/') => {
  const router = await renderRouter('./app', { initialUrl: url });
  await settle();
  return router;
};

beforeEach(async () => {
  backHandler = null;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_n: string, h: never) => {
    backHandler = h;
    return { remove: () => undefined };
  }) as never);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  progressStore.getState().reset();
  await act(() => setLanguageChoice('en'));
});
afterEach(async () => {
  jest.restoreAllMocks();
  await act(() => setLanguageChoice('system'));
});

describe('hardware back in the intro', () => {
  it('step 2 -> step 1 -> (Skip) learning page; the flag is set; the CTA then skips the intro', async () => {
    const router = await launch();
    await press('landing-start');
    await press('onboarding-next');
    expect(screen.getByTestId('onboarding-step-2')).toBeOnTheScreen();
    await systemBack();
    expect(screen.getByTestId('onboarding-step-1')).toBeOnTheScreen();
    expect(progressStore.getState().flags.onboardingSeen).toBeUndefined();
    await systemBack();
    expect(router.getPathname()).toBe('/learn');
    expect(progressStore.getState().flags.onboardingSeen).toBe(true);
    await press('learn-back');
    expect(router.getPathname()).toBe('/');
    await press('landing-start');
    expect(router.getPathname()).toBe('/learn');
  });

  it('replay: system Back on step 1 leaves to /learn and changes no progress', async () => {
    progressStore.getState().setFlag('onboardingSeen');
    await act(() => {
      progressStore.getState().record('u01-board', Array(6).fill('clean') as 'clean'[]);
    });
    const before = JSON.stringify(progressStore.getState().lessons);
    const router = await launch('/settings');
    await press('settings-intro');
    await systemBack();
    expect(router.getPathname()).toBe('/learn');
    expect(JSON.stringify(progressStore.getState().lessons)).toBe(before);
  });

  it('after Done, Back on the learning page goes to the landing page, never back into the intro', async () => {
    const router = await launch();
    await press('landing-start');
    await press('onboarding-next');
    await press('onboarding-next');
    await press('onboarding-finish');
    await press('learn-back');
    expect(router.getPathname()).toBe('/');
    // The landing page is the root: nothing is left to go back to (the OS leaves the app).
    expect(appRouter.canGoBack()).toBe(false);
  });
});

describe('who sees the intro', () => {
  it('progress but onboardingSeen false: straight to /learn, the flag stays unwritten', async () => {
    await act(() => {
      progressStore.getState().record('u02-liberties', Array(6).fill('clean') as 'clean'[]);
    });
    const router = await launch();
    await press('landing-start');
    expect(router.getPathname()).toBe('/learn');
    expect(progressStore.getState().flags.onboardingSeen).toBeUndefined();
  });

  it('Erase progress keeps onboardingSeen, so the CTA still goes to /learn', async () => {
    progressStore.getState().setFlag('onboardingSeen');
    progressStore.getState().setFlag('passExplained');
    progressStore.getState().reset({ keepFlags: ['atariHintsOff', 'onboardingSeen'] });
    const router = await launch();
    await press('landing-start');
    expect(router.getPathname()).toBe('/learn');
  });
});

describe('landing page robustness', () => {
  it('pressing Start learning twice quickly does not stack two intros', async () => {
    const router = await launch();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('landing-start'));
      await fireEvent.press(screen.getByTestId('landing-start'));
    });
    expect(router.getPathname()).toBe('/onboarding');
    await press('onboarding-skip');
    expect(router.getPathname()).toBe('/learn');
    await press('learn-back');
    expect(router.getPathname()).toBe('/');
  });

  it('the landing page shows in every language without a lesson list', async () => {
    progressStore.getState().setFlag('onboardingSeen');
    for (const lang of ['zh-CN', 'en', 'fr'] as const) {
      await act(() => setLanguageChoice(lang));
      await launch();
      expect(screen.getByTestId('landing-start')).toBeOnTheScreen();
      expect(screen.queryByTestId('home-continue')).toBeNull();
      expect(screen.queryByTestId('home-module-1')).toBeNull();
    }
  });
});
