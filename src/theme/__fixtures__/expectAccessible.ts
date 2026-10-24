// Shared accessibility audit for screen tests (docs/specs/M6-settings-onboarding-a11y.md AC 35).
// Every pressable must have a role, a name (label or text) and a tap target of at least 44×44.
import { StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

export const MIN_TAP = 44;

export interface A11yViolation {
  testID?: string;
  label?: string;
  problem: string;
}

type Insets = { top?: number; bottom?: number; left?: number; right?: number };

function textOf(node: ReactTestInstance): string {
  return node
    .findAll((n) => (n.type as unknown) === 'Text', { deep: true })
    .map((n) =>
      [n.props.children]
        .flat()
        .filter((c) => typeof c === 'string')
        .join(''),
    )
    .join(' ')
    .trim();
}

function slop(hitSlop: unknown): Insets {
  if (typeof hitSlop === 'number') {
    return { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop };
  }
  return (hitSlop as Insets | undefined) ?? {};
}

/** Hidden from screen readers on purpose (e.g. a sheet's tap-outside area). */
function hidden(node: ReactTestInstance): boolean {
  const p = node.props;
  return (
    p['aria-hidden'] === true ||
    p.accessibilityElementsHidden === true ||
    p.importantForAccessibility === 'no-hide-descendants'
  );
}

/**
 * The pressable host views (Pressable / Touchable render a host View with `onClick`), except the
 * ones hidden from screen readers on purpose.
 */
export function pressables(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (n) => typeof n.type === 'string' && typeof n.props.onClick === 'function' && !hidden(n),
    { deep: true },
  );
}

/** Every violation in the tree (empty when all pressables pass). */
export function accessibilityViolations(root: ReactTestInstance): A11yViolation[] {
  const out: A11yViolation[] = [];
  for (const node of pressables(root)) {
    const { accessibilityRole, accessibilityLabel, testID, hitSlop, role } = node.props;
    const label =
      typeof accessibilityLabel === 'string' && accessibilityLabel.trim().length > 0
        ? accessibilityLabel
        : textOf(node);
    const id = { testID, label };
    if (!accessibilityRole && !role) out.push({ ...id, problem: 'no accessibilityRole' });
    if (!label) out.push({ ...id, problem: 'no label or text' });
    const style = StyleSheet.flatten(node.props.style) ?? {};
    const pad = slop(hitSlop);
    const height = (style.minHeight ?? style.height) as number | undefined;
    const width = (style.minWidth ?? style.width) as number | undefined;
    if (typeof height !== 'number') {
      out.push({ ...id, problem: 'no minHeight/height' });
    } else if (height + (pad.top ?? 0) + (pad.bottom ?? 0) < MIN_TAP) {
      out.push({ ...id, problem: `height ${height} < ${MIN_TAP}` });
    }
    // A pressable without a width stretches to its parent (full-width rows and cards).
    if (typeof width === 'number' && width + (pad.left ?? 0) + (pad.right ?? 0) < MIN_TAP) {
      out.push({ ...id, problem: `width ${width} < ${MIN_TAP}` });
    }
  }
  return out;
}

/** Fails the test with the list of violations. */
export function expectAccessible(root: ReactTestInstance): void {
  expect(pressables(root).length).toBeGreaterThan(0);
  expect(accessibilityViolations(root)).toEqual([]);
}
