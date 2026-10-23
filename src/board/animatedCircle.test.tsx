// QA bug (M6-beginner-friendly AC 43 pattern): Animated forces `collapsable={false}` on its
// child; react-native-svg on web passes every prop to <circle>, so React warns "Received false
// for a non-boolean attribute collapsable". The animated stone circle must drop that prop.
import { render } from '@testing-library/react-native';
import { Circle } from 'react-native-svg';

import { CircleNoCollapse } from './GoBoard';

it('CircleNoCollapse renders a Circle without `collapsable`', () => {
  const { UNSAFE_getByType } = render(
    <CircleNoCollapse cx={1} cy={1} r={1} collapsable={false} testID="c" />,
  );
  const circle = UNSAFE_getByType(Circle);
  expect(circle.props).not.toHaveProperty('collapsable');
  expect(circle.props.r).toBe(1);
});
