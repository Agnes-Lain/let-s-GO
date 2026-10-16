// M2 PR 2 — accessibility (AC42-AC45).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { checkMove, createGame } from '@/engine';
import { setLanguageChoice } from '@/i18n';

import { GoBoard } from './GoBoard';
import { stonesFromSetup } from './geometry';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

const stones = stonesFromSetup(9, { B: ['e5'], W: ['c3'] });

function mockScreenReader(enabled: boolean) {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(enabled);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
}
async function renderBoard(ui: React.ReactElement) {
  const view = render(ui);
  await act(async () => {});
  return view;
}
// French typography uses (narrow) no-break spaces before ':'; compare with plain spaces.
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');
const label = (id: string) => plain(screen.getByTestId(id).props.accessibilityLabel as string);

beforeEach(async () => {
  await act(() => setLanguageChoice('en'));
  mockScreenReader(false);
});
afterEach(() => jest.restoreAllMocks());

describe('board label (AC42)', () => {
  it.each([
    ['en', '9 by 9 Go board. Black stones: 1, white stones: 1'],
    ['zh-CN', '9路棋盘。黑子 1，白子 1'],
    ['fr', 'Goban 9×9. Pierres noires : 1, pierres blanches : 1'],
  ] as const)('%s', async (language, expected) => {
    await act(() => setLanguageChoice(language));
    await renderBoard(<GoBoard size={9} stones={stones} width={328} />);
    expect(label('go-board')).toBe(expected);
  });
});

describe('one element per point with a screen reader (AC43)', () => {
  it('renders none while the screen reader is off (AC44)', async () => {
    await renderBoard(<GoBoard size={9} stones={stones} width={328} interactive />);
    expect(screen.queryAllByTestId(/^board-point-/)).toHaveLength(0);
  });

  it('renders 81 points with localized labels', async () => {
    mockScreenReader(true);
    await renderBoard(<GoBoard size={9} stones={stones} width={328} />);
    expect(screen.queryAllByTestId(/^board-point-/)).toHaveLength(81);
    expect(label('board-point-e5')).toBe('E5, black stone');
    expect(label('board-point-c3')).toBe('C3, white stone');
    expect(label('board-point-a1')).toBe('A1, empty');
    await act(() => setLanguageChoice('zh-CN'));
    expect(label('board-point-e5')).toBe('E5，黑子');
    await act(() => setLanguageChoice('fr'));
    expect(label('board-point-e5')).toBe('E5, pierre noire');
  });

  it('adds last move, marker and highlight parts', async () => {
    mockScreenReader(true);
    await renderBoard(
      <GoBoard
        size={9}
        stones={stones}
        width={328}
        lastMove={{ x: 4, y: 4 }}
        markers={[
          { kind: 'label', point: { x: 2, y: 1 }, text: 'A' },
          { kind: 'triangle', point: { x: 0, y: 0 } },
        ]}
        highlights={[
          { kind: 'liberty', points: [{ x: 1, y: 2 }] },
          { kind: 'hint', points: [{ x: 0, y: 0 }] },
        ]}
      />,
    );
    expect(label('board-point-e5')).toBe('E5, black stone, last move');
    expect(label('board-point-c2')).toBe('C2, empty, label A');
    expect(label('board-point-b3')).toBe('B3, empty, liberty');
    expect(label('board-point-a1')).toBe('A1, empty, triangle mark, hint');
  });

  it('uses the Chinese separator in zh-CN', async () => {
    mockScreenReader(true);
    await act(() => setLanguageChoice('zh-CN'));
    await renderBoard(<GoBoard size={9} stones={stones} width={328} lastMove={{ x: 4, y: 4 }} />);
    expect(label('board-point-e5')).toBe('E5，黑子，最后一手');
  });
});

describe('activating a point (AC44)', () => {
  it('is a button with a play hint and plays the point', async () => {
    mockScreenReader(true);
    const onPlay = jest.fn();
    await renderBoard(<GoBoard size={9} stones={stones} width={328} interactive onPlay={onPlay} />);
    const d4 = screen.getByTestId('board-point-d4');
    expect(d4.props.accessibilityRole).toBe('button');
    expect(d4.props.accessibilityHint).toBe('Double-tap to play here');
    fireEvent.press(d4);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledWith({ x: 3, y: 3 });
  });

  it('reports the checkPoint reason for an illegal point', async () => {
    mockScreenReader(true);
    const state = createGame(5, { setup: { B: ['a2', 'b1', 'c3'], W: ['d3', 'c4'] }, toPlay: 'W' });
    const onPlay = jest.fn();
    const onIllegal = jest.fn();
    await renderBoard(
      <GoBoard
        size={5}
        stones={state.board.cells}
        width={328}
        interactive
        checkPoint={(p) => checkMove(state, p)}
        onPlay={onPlay}
        onIllegal={onIllegal}
      />,
    );
    fireEvent.press(screen.getByTestId('board-point-a1'));
    expect(onIllegal).toHaveBeenCalledWith({ x: 0, y: 0 }, 'suicide');
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('is not a button when the board is display-only or disabled', async () => {
    mockScreenReader(true);
    const view = await renderBoard(<GoBoard size={9} stones={stones} width={328} />);
    expect(screen.getByTestId('board-point-d4').props.accessibilityRole).toBeUndefined();
    view.rerender(<GoBoard size={9} stones={stones} width={328} interactive disabled />);
    expect(screen.getByTestId('board-point-d4').props.accessibilityRole).toBeUndefined();
  });
});

describe('announcements (AC45)', () => {
  const props = { size: 9 as const, width: 328 };
  const before = stonesFromSetup(9, { B: ['e5'], W: ['d5'] });
  const after = stonesFromSetup(9, { B: ['e5', 'd4'] });

  it('announces the move and the captured stones once', async () => {
    mockScreenReader(true);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation();
    announce.mockClear();
    const view = await renderBoard(<GoBoard {...props} stones={before} />);
    expect(announce).not.toHaveBeenCalled();
    view.rerender(
      <GoBoard
        {...props}
        stones={after}
        lastMove={{ x: 3, y: 3 }}
        lastCapture={{ id: 2, color: 'W', points: [{ x: 3, y: 4 }] }}
      />,
    );
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Black played D4, Stones captured: 1');
  });

  it('announces a plain move without a capture part, in French too', async () => {
    mockScreenReader(true);
    await act(() => setLanguageChoice('fr'));
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation();
    announce.mockClear();
    const view = await renderBoard(<GoBoard {...props} stones={before} />);
    view.rerender(<GoBoard {...props} stones={after} lastMove={{ x: 3, y: 3 }} />);
    expect(announce).toHaveBeenCalledWith('Noir joue D4');
  });

  it('stays silent on mount, on undo and without a screen reader', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation();
    announce.mockClear();
    // screen reader off
    const off = await renderBoard(<GoBoard {...props} stones={before} />);
    off.rerender(<GoBoard {...props} stones={after} lastMove={{ x: 3, y: 3 }} />);
    expect(announce).not.toHaveBeenCalled();
    off.unmount();

    mockScreenReader(true);
    const on = await renderBoard(<GoBoard {...props} stones={after} lastMove={{ x: 3, y: 3 }} />);
    expect(announce).not.toHaveBeenCalled();
    // undo: d4 removed, lastMove back on e5 which was already occupied
    on.rerender(<GoBoard {...props} stones={before} lastMove={{ x: 4, y: 4 }} />);
    expect(announce).not.toHaveBeenCalled();
  });
});
