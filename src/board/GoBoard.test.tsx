import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, View } from 'react-native';

import { GoBoard } from './GoBoard';
import { boardGeometry, stonesFromSetup } from './geometry';

const empty9 = stonesFromSetup(9, {});

function flatStyle(el: { props: { style?: unknown } }) {
  return Object.assign({}, ...[el.props.style].flat(5).filter(Boolean));
}

describe('static rendering (AC9-AC15)', () => {
  it('draws star points, coordinate labels and a 328 px root (AC9)', async () => {
    await render(<GoBoard size={9} stones={empty9} width={328} />);
    const g = boardGeometry(9, 328, true);
    for (const v of ['c3', 'c7', 'e5', 'g3', 'g7']) {
      expect(screen.getByTestId(`board-star-${v}`).props.r).toBeCloseTo(g.starRadius, 2);
    }
    expect(screen.queryAllByTestId(/^board-star-/)).toHaveLength(5);
    for (const l of 'ABCDEFGHJ'.split(''))
      expect(screen.getByTestId(`board-label-col-${l}`)).toBeTruthy();
    expect(screen.queryByTestId('board-label-col-I')).toBeNull();
    for (let n = 1; n <= 9; n++) expect(screen.getByTestId(`board-label-row-${n}`)).toBeTruthy();
    const root = flatStyle(screen.getByTestId('go-board'));
    expect(root.width).toBe(328);
    expect(root.height).toBe(328);
  });

  it('hides labels and uses the larger cell without coordinates (AC10)', async () => {
    await render(
      <GoBoard
        size={9}
        stones={stonesFromSetup(9, { B: ['e5'] })}
        width={328}
        showCoordinates={false}
      />,
    );
    expect(screen.queryAllByTestId(/^board-label-/)).toHaveLength(0);
    expect(screen.getByTestId('board-stone-e5').props.r).toBeCloseTo(0.47 * 35.65, 1);
  });

  it('draws stones with the right colors and radius (AC11)', async () => {
    await render(
      <GoBoard size={9} stones={stonesFromSetup(9, { B: ['e5', 'c4'], W: ['c6'] })} width={328} />,
    );
    expect(screen.queryAllByTestId(/^board-stone-/)).toHaveLength(3);
    const e5 = screen.getByTestId('board-stone-e5').props;
    expect(e5.fill).toMatchObject({ payload: expect.anything() });
    expect(e5.r).toBeCloseTo(15.42, 2);
    expect(screen.getByTestId('board-stone-c4')).toBeTruthy();
    expect(screen.getByTestId('board-stone-c6').props.r).toBeCloseTo(15.42, 2);
  });

  it('survives a wrong stones length with one dev warning (AC12)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = await render(<GoBoard size={9} stones={[null, 'B']} width={328} />);
    await rerender(<GoBoard size={9} stones={[null, 'B']} width={328} />);
    expect(screen.queryAllByTestId(/^board-stone-/)).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('has no touch surface unless interactive-capable PR 2 (AC13)', async () => {
    await render(<GoBoard size={9} stones={empty9} width={328} />);
    expect(screen.queryByTestId('board-touch')).toBeNull();
  });

  it.each([5, 7, 13, 19] as const)('draws %i grid lines each way (AC14)', async (size) => {
    await render(<GoBoard size={size} stones={stonesFromSetup(size, {})} width={328} />);
    expect(screen.queryAllByTestId(/^board-grid-h-/)).toHaveLength(size);
    expect(screen.queryAllByTestId(/^board-grid-v-/)).toHaveLength(size);
    const stars = { 5: 1, 7: 1, 13: 5, 19: 9 }[size];
    expect(screen.queryAllByTestId(/^board-star-/)).toHaveLength(stars);
  });

  it('fills a 300 px parent after layout when no width is given (AC15)', async () => {
    await render(
      <View style={{ width: 300 }}>
        <GoBoard size={9} stones={empty9} />
      </View>,
    );
    await fireEvent(screen.getByTestId('go-board'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 300 } },
    });
    const root = flatStyle(screen.getByTestId('go-board'));
    expect(root.width).toBe(300);
    expect(root.height).toBe(300);
  });
});

/** react-native-svg keeps the text on a child RNSVGTSpan (`content` prop). */
function labelText(testID: string): string {
  const spans = screen
    .getByTestId(testID)
    .queryAll((n) => n.type === 'RNSVGTSpan' && typeof n.props.content === 'string');
  return spans.map((n) => n.props.content as string).join('');
}

describe('markers & highlights (AC16-AC20)', () => {
  const stones = stonesFromSetup(9, { B: ['e5'], W: ['c3'] });
  const at = (v: string) => ({
    x: v.charCodeAt(0) - 97 - (v[0] > 'i' ? 1 : 0),
    y: Number(v.slice(1)) - 1,
  });

  it('draws shape markers with stroke by stone color (AC16)', async () => {
    await render(
      <GoBoard
        size={9}
        stones={stones}
        width={328}
        markers={[
          { kind: 'circle', point: at('e5') },
          { kind: 'triangle', point: at('c3') },
          { kind: 'square', point: at('d4') },
          { kind: 'cross', point: at('f6') },
        ]}
      />,
    );
    for (const id of ['circle-e5', 'triangle-c3', 'square-d4', 'cross-f6']) {
      expect(screen.getByTestId(`board-marker-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('board-marker-circle-e5').props.strokeWidth).toBe(2);
    expect(screen.getByTestId('board-marker-circle-e5').props.stroke).toBeDefined();
    expect(JSON.stringify(screen.getByTestId('board-marker-circle-e5').props.stroke)).not.toEqual(
      JSON.stringify(screen.getByTestId('board-marker-square-d4').props.stroke),
    );
  });

  it('draws a label over a mask disc and truncates to 2 chars (AC17)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = await render(
      <GoBoard
        size={9}
        stones={stones}
        width={328}
        markers={[{ kind: 'label', point: at('c2'), text: 'A' }]}
      />,
    );
    expect(labelText('board-marker-label-c2')).toBe('A');
    const mask = screen.getByTestId('board-marker-label-mask-c2');
    expect(mask.props.r).toBeCloseTo(0.32 * 32.8, 2);
    expect(warn).not.toHaveBeenCalled();
    await rerender(
      <GoBoard
        size={9}
        stones={stones}
        width={328}
        markers={[{ kind: 'label', point: at('c2'), text: 'ABC' }]}
      />,
    );
    expect(labelText('board-marker-label-c2')).toBe('AB');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('draws liberty highlights below the stone layer (AC18)', async () => {
    await render(
      <GoBoard
        size={9}
        stones={stones}
        width={328}
        highlights={[{ kind: 'liberty', points: [at('b3'), at('c2')] }]}
      />,
    );
    const b3 = screen.getByTestId('board-highlight-liberty-b3');
    expect(screen.getByTestId('board-highlight-liberty-c2')).toBeTruthy();
    expect(b3.props.r).toBeCloseTo(0.22 * 32.8, 2);
    expect(b3.props.fillOpacity).toBe(0.18);
    expect(b3.props.strokeWidth).toBe(1.5);
    const all = screen
      .queryAllByTestId(/^board-(highlight-liberty|stone)-/)
      .map((e) => e.props.testID);
    expect(all.indexOf('board-highlight-liberty-b3')).toBeLessThan(all.indexOf('board-stone-e5'));
  });

  it('draws success/error rings above the stones (AC19)', async () => {
    await render(
      <GoBoard
        size={9}
        stones={stones}
        width={328}
        highlights={[
          { kind: 'success', points: [at('d4')] },
          { kind: 'error', points: [at('e5')] },
        ]}
      />,
    );
    const ok = screen.getByTestId('board-highlight-success-d4').props;
    const bad = screen.getByTestId('board-highlight-error-e5').props;
    expect(ok.r).toBeCloseTo(16.4, 2);
    expect(ok.strokeWidth).toBe(2.5);
    expect(bad.strokeWidth).toBe(2.5);
    const all = screen
      .queryAllByTestId(/^board-(highlight-error|stone)-/)
      .map((e) => e.props.testID);
    expect(all.indexOf('board-highlight-error-e5')).toBeGreaterThan(all.indexOf('board-stone-e5'));
  });

  describe('hint pulse (AC20)', () => {
    const hint = [{ kind: 'hint' as const, points: [at('d3')] }];

    afterEach(() => jest.restoreAllMocks());

    it('pulses 3 cycles of 1200 ms with reduce motion off', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const loop = jest.spyOn(Animated, 'loop');
      const timing = jest.spyOn(Animated, 'timing');
      await render(<GoBoard size={9} stones={stones} width={328} highlights={hint} />);
      await act(async () => {});
      expect(screen.getByTestId('board-highlight-hint-d3')).toBeTruthy();
      expect(loop).toHaveBeenCalledWith(expect.anything(), { iterations: 3 });
      const total = timing.mock.calls.slice(0, 2).reduce((s, c) => s + (c[1].duration ?? 0), 0);
      expect(total).toBe(1200);
    });

    it('is static from the start with reduce motion on', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const loop = jest.spyOn(Animated, 'loop');
      await render(<GoBoard size={9} stones={stones} width={328} highlights={hint} />);
      await act(async () => {});
      expect(screen.getByTestId('board-highlight-hint-d3')).toBeTruthy();
      expect(loop).not.toHaveBeenCalled();
    });
  });
});
