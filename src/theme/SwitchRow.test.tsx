// SwitchRow on the web (docs/specs/M6-settings-onboarding-a11y.md AC 45): react-native-web 0.21
// renders no aria-checked from accessibilityState and only presses role="button" on Space, so the
// row passes aria-checked itself and toggles on Space. Native folds aria-* into accessibilityState,
// so the tests read the composite's props.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SwitchRow } from './SwitchRow';

const space = () => ({ key: ' ', preventDefault: jest.fn() });

describe('SwitchRow', () => {
  it('passes aria-checked for the web', () => {
    const { rerender } = render(<SwitchRow title="Sound" value onChange={jest.fn()} testID="s" />);
    expect(screen.UNSAFE_getAllByProps({ testID: 's', 'aria-checked': true })).not.toHaveLength(0);
    rerender(<SwitchRow title="Sound" value={false} onChange={jest.fn()} testID="s" />);
    expect(screen.UNSAFE_getAllByProps({ testID: 's', 'aria-checked': false })).not.toHaveLength(0);
  });

  it('Space toggles the switch and does not scroll the page', () => {
    const onChange = jest.fn();
    render(<SwitchRow title="Sound" value={false} onChange={onChange} testID="s" />);
    const event = space();
    fireEvent(screen.getByTestId('s'), 'keyDown', event);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('other keys and a disabled row change nothing', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <SwitchRow title="Sound" value={false} onChange={onChange} testID="s" />,
    );
    fireEvent(screen.getByTestId('s'), 'keyDown', { key: 'a', preventDefault: jest.fn() });
    rerender(<SwitchRow title="Sound" value={false} onChange={onChange} disabled testID="s" />);
    fireEvent(screen.getByTestId('s'), 'keyDown', space());
    expect(onChange).not.toHaveBeenCalled();
  });
});
