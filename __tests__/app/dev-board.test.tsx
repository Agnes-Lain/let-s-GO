import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import { boardGeometry, pointToLocation } from '@/board';
import { parseVertex } from '@/engine';
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

/** Touch down + up on a vertex of the demo board, using the rendered board size. */
async function tap(vertex: string) {
  const style = flat(screen.getByTestId('go-board').props.style);
  const size = screen.queryAllByTestId(/^board-grid-h-/).length as 5 | 7 | 9 | 13 | 19;
  const coordinates = screen.queryAllByTestId(/^board-label-/).length > 0;
  const { x, y } = pointToLocation(
    boardGeometry(size, style.width, coordinates),
    parseVertex(vertex, size),
  );
  const nativeEvent = { locationX: x, locationY: y };
  await fireEvent(screen.getByTestId('board-touch'), 'responderGrant', { nativeEvent });
  await fireEvent(screen.getByTestId('board-touch'), 'responderRelease', { nativeEvent });
}
const stoneIds = () =>
  screen
    .queryAllByTestId(/^board-stone-/)
    .map((e) => e.props.testID.slice(12))
    .sort();
const disabled = (name: string) =>
  screen.getByRole('button', { name }).props.accessibilityState.disabled;

const KO_TEXT = "Ko (打劫 dǎjié): you can't take back right away. Play elsewhere first.";
const SUICIDE_TEXT =
  'Forbidden point (禁入点 jìnrùdiǎn): your stone would have no liberties and captures nothing.';

describe('/dev/board is playable (AC49-AC52, AC54-AC56)', () => {
  it('AC49: a tap places a black stone with the last-move dot, flips the turn, enables Undo', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await act(async () => tap('e5'));
    expect(stoneIds()).toEqual(['e5']);
    expect(screen.getByTestId('board-last-move')).toBeTruthy();
    expect(screen.getByText('White to play')).toBeOnTheScreen();
    expect(disabled('Undo')).toBe(false);
    await act(async () => tap('d5'));
    expect(stoneIds()).toEqual(['d5', 'e5']);
    expect(screen.getByText('Black to play')).toBeOnTheScreen();
  });

  it('AC50: Capture scenario - B c4 captures c3', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await fireEvent.press(screen.getByRole('button', { name: 'Capture' }));
    await act(async () => tap('c4'));
    expect(stoneIds()).toEqual(['b3', 'c2', 'c4', 'd3']);
    expect(screen.getByText('White to play')).toBeOnTheScreen();
    expect(screen.getByText('Captures B 1 · W 0')).toBeOnTheScreen();
  });

  it('AC51: Ko scenario - immediate retake shows the ko message, later it is legal', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await fireEvent.press(screen.getByRole('button', { name: 'Ko' }));
    await act(async () => tap('d3')); // B captures c3
    expect(stoneIds()).not.toContain('c3');
    await act(async () => tap('c3')); // W retakes at once: ko
    expect(screen.getByText(KO_TEXT)).toBeOnTheScreen();
    expect(stoneIds()).not.toContain('c3');
    expect(screen.getByText('White to play')).toBeOnTheScreen();
    await act(async () => tap('a1')); // W elsewhere (clears the message)
    expect(screen.queryByText(KO_TEXT)).toBeNull();
    await act(async () => tap('a5')); // B elsewhere
    await act(async () => tap('c3')); // W retakes: legal now
    expect(stoneIds()).toContain('c3');
    expect(stoneIds()).not.toContain('d3');
    expect(screen.getByText('Captures B 1 · W 1')).toBeOnTheScreen();
  });

  it('AC52: Forbidden scenario - W a1 shows the suicide message and changes nothing', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await fireEvent.press(screen.getByRole('button', { name: 'Forbidden' }));
    const before = stoneIds();
    await act(async () => tap('a1'));
    expect(screen.getByText(SUICIDE_TEXT)).toBeOnTheScreen();
    expect(stoneIds()).toEqual(before);
    expect(screen.getByText('White to play')).toBeOnTheScreen();
  });

  it('occupied point shows the occupied message', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await act(async () => tap('e5'));
    await act(async () => tap('e5'));
    expect(screen.getByText('There is already a stone here.')).toBeOnTheScreen();
  });

  it('AC54: Undo restores the Capture start; Reset restarts the scenario', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await fireEvent.press(screen.getByRole('button', { name: 'Capture' }));
    await act(async () => tap('c4'));
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(stoneIds()).toEqual(['b3', 'c2', 'c3', 'd3']);
    expect(screen.getByText('Black to play')).toBeOnTheScreen();
    expect(screen.getByText('Captures B 0 · W 0')).toBeOnTheScreen();
    expect(screen.queryByTestId('board-last-move')).toBeNull();
    expect(disabled('Undo')).toBe(true);

    await act(async () => tap('c4'));
    await act(async () => tap('a1'));
    await fireEvent.press(screen.getByRole('button', { name: 'Reset' }));
    expect(stoneIds()).toEqual(['b3', 'c2', 'c3', 'd3']);
    expect(screen.getByText('Captures B 0 · W 0')).toBeOnTheScreen();
    expect(disabled('Undo')).toBe(true);
  });

  it('AC55: toggles flip their checked state and the board follows', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await fireEvent.press(screen.getByRole('switch', { name: 'Show coordinates' }));
    expect(
      screen.getByRole('switch', { name: 'Show coordinates' }).props.accessibilityState.checked,
    ).toBe(false);
    expect(screen.queryAllByTestId(/^board-label-/)).toHaveLength(0);
    await fireEvent.press(screen.getByRole('switch', { name: 'Stone sound' }));
    expect(
      screen.getByRole('switch', { name: 'Stone sound' }).props.accessibilityState.checked,
    ).toBe(false);
  });

  it('AC56: the message disappears on a legal move, Undo, Reset, size and scenario change', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    const showMessage = async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Forbidden' }));
      await act(async () => tap('a1'));
      expect(screen.getByText(SUICIDE_TEXT)).toBeOnTheScreen();
    };
    await showMessage();
    await fireEvent.press(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.queryByText(SUICIDE_TEXT)).toBeNull();

    await showMessage();
    await act(async () => tap('e3')); // legal W move
    expect(screen.queryByText(SUICIDE_TEXT)).toBeNull();

    await showMessage();
    await fireEvent.press(screen.getByRole('button', { name: '7 by 7 board' }));
    expect(screen.queryByText(SUICIDE_TEXT)).toBeNull();

    await showMessage();
    await fireEvent.press(screen.getByRole('button', { name: 'Capture' }));
    expect(screen.queryByText(SUICIDE_TEXT)).toBeNull();

    // Undo: make a move, trigger an occupied message, then undo.
    await act(async () => tap('c4'));
    await act(async () => tap('c4'));
    expect(screen.getByText('There is already a stone here.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByText('There is already a stone here.')).toBeNull();
  });

  it('the message card announces itself politely and keeps its reserved height', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await fireEvent.press(screen.getByRole('button', { name: 'Forbidden' }));
    await act(async () => tap('a1'));
    expect(screen.getByTestId('board-demo-message').props.accessibilityLiveRegion).toBe('polite');
  });
});

describe('/dev/board stable test IDs for the web verification (AC57–59)', () => {
  it('gives every size segment, scenario chip and action a locale-independent testID', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    for (const size of [5, 7, 9, 13, 19]) {
      expect(screen.getByTestId(`board-demo-size-${size}`)).toBeOnTheScreen();
    }
    for (const id of ['free', 'capture', 'ko', 'forbidden', 'markers']) {
      expect(screen.getByTestId(`board-demo-scenario-${id}`)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('board-demo-undo')).toBeOnTheScreen();
    expect(screen.getByTestId('board-demo-reset')).toBeOnTheScreen();
  });

  it('the size testID selects that size', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await fireEvent.press(screen.getByTestId('board-demo-size-19'));
    expect(screen.queryAllByTestId(/^board-star-/)).toHaveLength(9);
  });
});
