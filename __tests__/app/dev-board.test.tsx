import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import { setLanguageChoice } from '@/i18n';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

beforeEach(async () => {
  await act(() => setLanguageChoice('en'));
});

function flat(style: unknown) {
  return Object.assign({}, ...[style].flat(5).filter(Boolean));
}

describe('Settings dev row (AC46)', () => {
  it('shows the Board demo row in __DEV__ and navigates to /dev/board', async () => {
    const router = await renderRouter('./app', { initialUrl: '/settings' });
    const row = screen.getByRole('button', { name: 'Board demo (dev)' });
    expect(flat(row.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(row);
    expect(router.getPathname()).toBe('/dev/board');
  });

  it('hides the row when __DEV__ is false', async () => {
    const original = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      await renderRouter('./app', { initialUrl: '/settings' });
      expect(screen.queryByRole('button', { name: 'Board demo (dev)' })).toBeNull();
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = original;
    }
  });
});

describe('/dev/board (AC47, AC48, AC53)', () => {
  it('opens with a 9x9 Free board, black to play, captures 0/0, toggles on', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    expect(screen.getByText('Board demo')).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^board-star-/)).toHaveLength(5);
    expect(screen.getByText('Black to play')).toBeOnTheScreen();
    expect(screen.getByText('Captures B 0 · W 0')).toBeOnTheScreen();
    expect(
      screen.getByRole('switch', { name: 'Show coordinates' }).props.accessibilityState.checked,
    ).toBe(true);
    expect(
      screen.getByRole('switch', { name: 'Stone sound' }).props.accessibilityState.checked,
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: '9 by 9 board' }).props.accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Free' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Undo' }).props.accessibilityState.disabled).toBe(
      true,
    );
    expect(screen.queryAllByTestId(/^board-stone-/)).toHaveLength(0);
  });

  it('switches to an empty 5x5 board when 5x5 is pressed', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await fireEvent.press(screen.getByRole('button', { name: '5 by 5 board' }));
    expect(screen.queryAllByTestId(/^board-grid-h-/)).toHaveLength(5);
    expect(screen.queryAllByTestId(/^board-stone-/)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Free' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByText('Black to play')).toBeOnTheScreen();
  });

  it('toggles coordinates off', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await fireEvent.press(screen.getByRole('switch', { name: 'Show coordinates' }));
    expect(screen.queryAllByTestId(/^board-label-/)).toHaveLength(0);
  });

  it('shows the Capture, Ko and Forbidden setups', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    const stones = () =>
      screen
        .queryAllByTestId(/^board-stone-/)
        .map((e) => e.props.testID.slice(12))
        .sort();
    await fireEvent.press(screen.getByRole('button', { name: 'Capture' }));
    expect(stones()).toEqual(['b3', 'c2', 'c3', 'd3']);
    await fireEvent.press(screen.getByRole('button', { name: 'Ko' }));
    expect(stones()).toEqual(['b3', 'c2', 'c3', 'c4', 'd2', 'd4', 'e3']);
    await fireEvent.press(screen.getByRole('button', { name: 'Forbidden' }));
    expect(stones()).toEqual(['a2', 'b1', 'c3', 'c4', 'd3']);
    expect(screen.getByText('White to play')).toBeOnTheScreen();
  });

  it('Marks scenario: 7x7 with the exact markers and a hint ring (AC53)', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await fireEvent.press(screen.getByRole('button', { name: 'Marks' }));
    expect(screen.queryAllByTestId(/^board-grid-h-/)).toHaveLength(7);
    const ids = screen
      .queryAllByTestId(/^board-(marker|highlight)-(?!label-mask)/)
      .map((e) => e.props.testID)
      .sort();
    expect(ids).toEqual(
      [
        'board-marker-circle-c5',
        'board-marker-triangle-e3',
        'board-marker-square-b2',
        'board-marker-cross-f6',
        'board-marker-label-c2',
        'board-marker-label-f2',
        'board-highlight-hint-d3',
      ].sort(),
    );
  });

  it('every control is at least 44 px', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    const names = ['5 by 5 board', '19 by 19 board', 'Free', 'Marks', 'Undo', 'Reset'];
    for (const name of names) {
      const s = flat(screen.getByRole('button', { name }).props.style);
      expect(s.minHeight ?? s.height).toBeGreaterThanOrEqual(44);
    }
    for (const name of ['Show coordinates', 'Stone sound']) {
      const s = flat(screen.getByRole('switch', { name }).props.style);
      expect(s.width).toBeGreaterThanOrEqual(44);
      expect(s.height).toBeGreaterThanOrEqual(44);
    }
    void within;
  });
});
