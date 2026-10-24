// QA: M3 AC 108 — switching language re-renders the unit titles on a mounted home screen.
import { act, renderRouter, screen } from 'expo-router/testing-library';

import { setLanguageChoice } from '@/i18n';
import { progressStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

it('AC 108: language change re-renders unit titles without remount', async () => {
  // M6-settings: a returning learner, past the first-launch intro.
  progressStore.getState().setFlag('onboardingSeen');
  await act(() => setLanguageChoice('en'));
  await renderRouter('./app', { initialUrl: '/learn' });
  await act(async () => {});
  expect(screen.getByText(/Liberties/)).toBeTruthy();
  await act(() => setLanguageChoice('fr'));
  expect(screen.getByText(/Libertés/)).toBeTruthy();
  expect(screen.queryByText(/^Liberties/)).toBeNull();
  await act(() => setLanguageChoice('zh-CN'));
  expect(screen.getByText('气')).toBeTruthy();
  await act(() => setLanguageChoice('system'));
});
