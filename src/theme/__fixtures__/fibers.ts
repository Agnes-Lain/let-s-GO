// RNTL 14 queries return host elements only, so `UNSAFE_getByType` / `UNSAFE_getAllByProps` are
// gone. The few tests that check what a component hands to another component (e.g. `aria-checked`
// on a Pressable, which RN folds into the host view's accessibilityState) read the props of the
// rendered React tree instead, through the (unstable) fiber of a host element.
import type { TestInstance } from 'test-renderer';

type Props = Record<string, any>;
interface Fiber {
  type: unknown;
  elementType: unknown;
  memoizedProps: unknown;
  child: Fiber | null;
  sibling: Fiber | null;
  return: Fiber | null;
}

function rootFiber(container: TestInstance): Fiber {
  const host = container.queryAll(() => true)[0];
  let fiber = host?.unstable_fiber as Fiber | null | undefined;
  if (!fiber) throw new Error('nothing rendered');
  while (fiber.return) fiber = fiber.return;
  return fiber;
}

/** Props of every element (composite or host) in the rendered tree, in render order. */
function allProps(container: TestInstance): { fiber: Fiber; props: Props }[] {
  const out: { fiber: Fiber; props: Props }[] = [];
  const visit = (fiber: Fiber | null) => {
    for (let f = fiber; f; f = f.sibling) {
      if (f.memoizedProps && typeof f.memoizedProps === 'object') {
        out.push({ fiber: f, props: f.memoizedProps as Props });
      }
      visit(f.child);
    }
  };
  visit(rootFiber(container));
  return out;
}

/** Props of every element of `type` (like RNTL 13 `UNSAFE_getAllByType(type)[i].props`). */
export function propsOfType(container: TestInstance, type: unknown): Props[] {
  return allProps(container)
    .filter(({ fiber }) => fiber.type === type || fiber.elementType === type)
    .map(({ props }) => props);
}

/** Props of the one element of `type` (like RNTL 13 `UNSAFE_getByType(type).props`). */
export function propsOfOnly(container: TestInstance, type: unknown): Props {
  const found = propsOfType(container, type);
  if (found.length !== 1) throw new Error(`expected 1 element of the type, found ${found.length}`);
  return found[0];
}

/** Props of every element whose props include `match` (like RNTL 13 `UNSAFE_getAllByProps`). */
export function propsMatching(container: TestInstance, match: Props): Props[] {
  return allProps(container)
    .map(({ props }) => props)
    .filter((props) => Object.entries(match).every(([key, value]) => props[key] === value));
}
