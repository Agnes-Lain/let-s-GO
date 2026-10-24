// Module headers on the web (docs/specs/M6-settings-onboarding-a11y.md AC 45): react-native-web 0.21
// renders no aria-expanded from accessibilityState, so the header passes aria-expanded itself.
// (Space already presses a role="button" on react-native-web.)
import { render, screen } from '@testing-library/react-native';

import { MODULES } from '@/lessons';

import { ModuleHeader } from './UnitMap';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

const summary = { module: MODULES[0], rows: [], done: 0, total: 3, locked: false };

describe('ModuleHeader', () => {
  it('passes aria-expanded for the web', () => {
    const { rerender } = render(<ModuleHeader summary={summary} expanded onToggle={jest.fn()} />);
    expect(
      screen.UNSAFE_getAllByProps({ testID: 'home-module-1', 'aria-expanded': true }),
    ).not.toHaveLength(0);
    rerender(<ModuleHeader summary={summary} expanded={false} onToggle={jest.fn()} />);
    expect(
      screen.UNSAFE_getAllByProps({ testID: 'home-module-1', 'aria-expanded': false }),
    ).not.toHaveLength(0);
  });
});
