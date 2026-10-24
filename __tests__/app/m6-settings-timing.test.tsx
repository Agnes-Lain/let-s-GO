// Settings → Erase: the "Progress erased." line stays 4 s (docs/specs/M6-settings-onboarding-a11y.md §5.1).
import { router as appRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { RESET_DONE_MS } from '../../app/settings';
import { setLanguageChoice } from '@/i18n';
import { progressStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

const press = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};

beforeEach(async () => {
  jest.useFakeTimers();
  progressStore.getState().reset();
  progressStore.getState().setFlag('onboardingSeen');
  await act(() => setLanguageChoice('en'));
});
afterEach(async () => {
  jest.useRealTimers();
  await act(() => setLanguageChoice('system'));
});

it('the done line stays 4 s, then goes away', async () => {
  expect(RESET_DONE_MS).toBe(4000);
  await renderRouter('./app', { initialUrl: '/' });
  await act(async () => {});
  await act(() => appRouter.push('/settings'));
  await act(async () => {});
  await press('settings-reset');
  await press('settings-reset-confirm');
  await act(async () => jest.advanceTimersByTime(3900));
  expect(screen.getByTestId('settings-reset-done')).toBeOnTheScreen();
  await act(async () => jest.advanceTimersByTime(100));
  expect(screen.queryByTestId('settings-reset-done')).toBeNull();
});
