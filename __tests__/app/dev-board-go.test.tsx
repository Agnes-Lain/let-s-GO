// QA: Go-correctness edge cases played through the /dev/board demo screen.
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

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
async function tap(vertex: string) {
  const style = flat(screen.getByTestId('go-board').props.style);
  const size = screen.queryAllByTestId(/^board-grid-h-/).length as 5 | 7 | 9 | 13 | 19;
  const coordinates = screen.queryAllByTestId(/^board-label-/).length > 0;
  const { x, y } = pointToLocation(
    boardGeometry(size, style.width, coordinates),
    parseVertex(vertex, size),
  );
  const nativeEvent = { locationX: x, locationY: y };
  await act(async () => {
    fireEvent(screen.getByTestId('board-touch'), 'responderGrant', { nativeEvent });
    fireEvent(screen.getByTestId('board-touch'), 'responderRelease', { nativeEvent });
  });
}
async function play(...vs: string[]) {
  for (const v of vs) await tap(v);
}
const stones = () =>
  screen
    .queryAllByTestId(/^board-stone-/)
    .map((e) => e.props.testID.slice(12))
    .sort();
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const SUICIDE =
  'Forbidden point (禁入点 jìnrùdiǎn): your stone would have no liberties and captures nothing.';

describe('demo screen Go edge cases', () => {
  it('captures a two-stone corner group and counts both stones; Undo restores them', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    // a2 b2 c1 surround W a1+b1
    await play('a2', 'a1', 'b2', 'b1', 'c1');
    expect(stones()).toEqual(['a2', 'b2', 'c1']);
    expect(screen.getByText('Captures B 2 · W 0')).toBeOnTheScreen();
    expect(screen.getByText('White to play')).toBeOnTheScreen();
    await press('Undo');
    expect(stones()).toEqual(['a1', 'a2', 'b1', 'b2']);
    expect(screen.getByText('Captures B 0 · W 0')).toBeOnTheScreen();
    expect(screen.getByText('Black to play')).toBeOnTheScreen();
  });

  it('suicide is refused and does not change the turn; a legal move after it is accepted', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await play('e5', 'a2', 'e6', 'b1'); // black to play; a1 is surrounded by W
    await tap('a1');
    expect(screen.getByText(SUICIDE)).toBeOnTheScreen();
    expect(stones()).not.toContain('a1');
    expect(screen.getByText('Black to play')).toBeOnTheScreen();
    await tap('e7');
    expect(screen.queryByText(SUICIDE)).toBeNull();
    expect(screen.getByText('White to play')).toBeOnTheScreen();
  });

  it('a move that fills the last liberty but captures is legal (not suicide)', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    // W b1 (c1,b2 black) and W a2 (a3,b2 black): a1 captures both.
    await play('c1', 'b1', 'b2', 'a2', 'a3', 'e5');
    await tap('a1');
    expect(screen.queryByText(SUICIDE)).toBeNull();
    expect(stones()).toContain('a1');
    expect(stones()).not.toContain('b1');
    expect(stones()).not.toContain('a2');
    expect(screen.getByText('Captures B 2 · W 0')).toBeOnTheScreen();
  });

  it('white cannot fill its own last liberty (suicide for W is refused too)', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await play('c1', 'b1', 'b2', 'a2', 'a3'); // white to play: a1 would be suicide
    await tap('a1');
    expect(screen.getByText(SUICIDE)).toBeOnTheScreen();
    expect(screen.getByText('White to play')).toBeOnTheScreen();
  });

  it('playing on an occupied point is refused, keeps the turn and the stones', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await play('e5');
    await tap('e5');
    expect(screen.getByText('There is already a stone here.')).toBeOnTheScreen();
    expect(stones()).toEqual(['e5']);
    expect(screen.getByText('White to play')).toBeOnTheScreen();
    await tap('d5'); // white now plays: colour is white, not black
    expect(screen.getByText('Black to play')).toBeOnTheScreen();
    expect(stones()).toEqual(['d5', 'e5']);
  });

  it('illegal attempts do not add an Undo step', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await play('e5', 'e5', 'e5');
    await press('Undo');
    expect(stones()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Undo' }).props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('Undo after a ko capture restores the position and the counts; the ko ban is gone', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await press('Ko');
    await play('d3'); // B captures c3
    await press('Undo');
    expect(stones()).toEqual(['b3', 'c2', 'c3', 'c4', 'd2', 'd4', 'e3']);
    expect(screen.getByText('Captures B 0 · W 0')).toBeOnTheScreen();
    await play('d3'); // capturing again works
    expect(screen.getByText('Captures B 1 · W 0')).toBeOnTheScreen();
  });

  it('Reset after captures restarts the scenario with zero counts', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await play('a2', 'a1', 'b2', 'b1', 'c1');
    await press('Reset');
    expect(stones()).toEqual([]);
    expect(screen.getByText('Captures B 0 · W 0')).toBeOnTheScreen();
    expect(screen.getByText('Black to play')).toBeOnTheScreen();
  });

  it('Reset on the Forbidden scenario keeps White to play', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await press('Forbidden');
    await play('e3');
    await press('Reset');
    expect(screen.getByText('White to play')).toBeOnTheScreen();
  });

  it('a repeated illegal ko attempt keeps showing the ko message and never flips the turn', async () => {
    await renderRouter('./app', { initialUrl: '/dev/board' });
    await press('Ko');
    await play('d3', 'c3', 'c3');
    expect(
      screen.getByText("Ko (打劫 dǎjié): you can't take back right away. Play elsewhere first."),
    ).toBeOnTheScreen();
    expect(screen.getByText('White to play')).toBeOnTheScreen();
  });
});
