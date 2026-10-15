import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router as appRouter } from 'expo-router';

import { setLanguageChoice } from '@/i18n';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

beforeEach(async () => {
  await act(() => setLanguageChoice('system'));
});

describe('Lesson placeholder (AC20)', () => {
  it('shows title, id, coming-soon text and a back button to Home', async () => {
    const router = await renderRouter('./app', { initialUrl: '/' });
    await fireEvent.press(screen.getByRole('button', { name: 'Unit 1 · Board & stones' }));
    expect(router.getPathname()).toBe('/lesson/u01-board');

    expect(screen.getAllByText('Lesson').length).toBeGreaterThan(0);
    expect(screen.getByText('u01-board')).toBeOnTheScreen();
    expect(screen.getByText('This part is coming soon. Stay tuned!')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('Learning path')).toBeOnTheScreen();
  });

  it('goes to Home when opened directly (no history)', async () => {
    const router = await renderRouter('./app', { initialUrl: '/lesson/u01-board' });
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.getPathname()).toBe('/');
  });

  it('shows the lesson placeholder in Chinese', async () => {
    await act(() => setLanguageChoice('zh-CN'));
    await renderRouter('./app', { initialUrl: '/lesson/u01-board' });
    expect(screen.getAllByText('课程').length).toBeGreaterThan(0);
    expect(screen.getByText('这里很快就会有内容，敬请期待！')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '返回' })).toBeOnTheScreen();
  });
});

describe('Practice placeholder (AC21)', () => {
  it('shows title, id and coming-soon text; back returns to the previous screen', async () => {
    const router = await renderRouter('./app', { initialUrl: '/settings' });
    await act(() => appRouter.push('/practice/abc'));
    expect(router.getPathname()).toBe('/practice/abc');

    expect(screen.getAllByText('Practice').length).toBeGreaterThan(0);
    expect(screen.getByText('abc')).toBeOnTheScreen();
    expect(screen.getByText('This part is coming soon. Stay tuned!')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.getPathname()).toBe('/settings');
  });

  it('goes to Home when there is no previous screen', async () => {
    const router = await renderRouter('./app', { initialUrl: '/practice/abc' });
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
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
