// QA bug (M6-beginner-friendly AC 43 pattern): Animated forces `collapsable={false}` on its
// child; react-native-svg on web passes every prop to <circle>, so React warns "Received false
// for a non-boolean attribute collapsable". The animated stone circle must drop that prop.
import { render, screen } from '@testing-library/react-native';
import { Circle } from 'react-native-svg';

import { propsOfOnly } from '@/theme/__fixtures__/fibers';

import { CircleNoCollapse } from './GoBoard';

it('CircleNoCollapse renders a Circle without `collapsable`', async () => {
  await render(<CircleNoCollapse cx={1} cy={1} r={1} collapsable={false} testID="c" />);
  const circle = propsOfOnly(screen.container, Circle);
  expect(circle).not.toHaveProperty('collapsable');
  expect(circle.r).toBe(1);
});
