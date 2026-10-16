import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router as appRouter } from 'expo-router';

import { setLanguageChoice } from '@/i18n';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

beforeEach(async () => {
  await act(() => setLanguageChoice('system'));
});

// M3 replaced the lesson placeholder with the explanation player (see lesson.test.tsx).
describe('Lesson route without a lesson (M3 AC 55)', () => {
  it('shows the error screen; Back to map returns Home', async () => {
    const router = await renderRouter('./app', { initialUrl: '/' });
    await act(() => appRouter.push('/lesson/u01-board'));
    expect(screen.getByText("This lesson can't be opened")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to map' }));
    expect(router.getPathname()).toBe('/');
  });

  it('goes to Home when opened directly (no history)', async () => {
    const router = await renderRouter('./app', { initialUrl: '/lesson/u01-board' });
    await fireEvent.press(screen.getByRole('button', { name: 'Back to map' }));
    expect(router.getPathname()).toBe('/');
  });

  it('is translated (Chinese)', async () => {
    await act(() => setLanguageChoice('zh-CN'));
    await renderRouter('./app', { initialUrl: '/lesson/u01-board' });
    expect(screen.getByText('这一课打不开')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '回到学习路径' })).toBeOnTheScreen();
  });
});

// M3 replaced the practice placeholder with the exercise runners (see practice.test.tsx).
describe('Practice route without a lesson (M3 AC 55, §6.7)', () => {
  it('shows the error screen; Back to map returns Home', async () => {
    const router = await renderRouter('./app', { initialUrl: '/settings' });
    await act(() => appRouter.push('/practice/abc'));
    expect(router.getPathname()).toBe('/practice/abc');
    expect(screen.getByText("This lesson can't be opened")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to map' }));
    expect(router.getPathname()).toBe('/');
  });
});

describe('Not found (AC22)', () => {
  it('shows the not-found title and a button back to Home', async () => {
    const router = await renderRouter('./app', { initialUrl: '/nope' });
    expect(screen.getByText('Page not found')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to home' }));
    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('Learning path')).toBeOnTheScreen();
  });
});
