import Svg, { Path } from 'react-native-svg';

type IconProps = { size?: number; color: string };

// Simple stroke icons drawn with react-native-svg (no icon font or image files).
// Icons are decorative: the pressable around them carries the accessibility label.

/** Gear outline: 8 trapezoid teeth around a ring, with a round hole (even-odd fill). */
function gearPath(): string {
  const point = (radius: number, angle: number) =>
    `${(12 + radius * Math.cos(angle)).toFixed(2)} ${(12 + radius * Math.sin(angle)).toFixed(2)}`;
  const teeth = 8;
  const step = (2 * Math.PI) / teeth;
  const parts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    parts.push(
      point(7.4, a - step * 0.3),
      point(10, a - step * 0.17),
      point(10, a + step * 0.17),
      point(7.4, a + step * 0.3),
    );
  }
  const hole = 'M15 12 A3 3 0 1 0 9 12 A3 3 0 1 0 15 12 Z';
  return `M${parts.join(' L')} Z ${hole}`;
}

const GEAR_PATH = gearPath();

export function GearIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d={GEAR_PATH} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function ChevronIcon({
  size = 20,
  color,
  direction = 'right',
}: IconProps & { direction?: 'left' | 'right' }) {
  const d = direction === 'right' ? 'M9 5 L16 12 L9 19' : 'M15 5 L8 12 L15 19';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path
        d={d}
        stroke={color}
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CheckIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path
        d="M5 12.5 L10 17.5 L19 7"
        stroke={color}
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StrokeIcon({
  size = 20,
  color,
  d,
  width = 2.2,
}: IconProps & { d: string; width?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path
        d={d}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return <StrokeIcon {...props} d="M6 6 L18 18 M18 6 L6 18" width={2.4} />;
}

/** Circular arrow for "Replay". */
export function ReplayIcon(props: IconProps) {
  return <StrokeIcon {...props} d="M19 12 A7 7 0 1 1 16.5 6.6 M17 3 L17 7 L13 7" />;
}

export function LockIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path
        d="M8 10 V7.5 A4 4 0 0 1 16 7.5 V10"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M5.5 10 H18.5 V20 H5.5 Z" fill={color} />
    </Svg>
  );
}

const STAR_PATH =
  'M12 2.8 L14.7 8.6 L21 9.3 L16.3 13.6 L17.6 19.8 L12 16.6 L6.4 19.8 L7.7 13.6 L3 9.3 L9.3 8.6 Z';

/** Filled star, or an outline when `filled` is false. */
export function StarIcon({ size = 20, color, filled = true }: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path
        d={STAR_PATH}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : 1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PlayIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d="M7 4.5 L19.5 12 L7 19.5 Z" fill={color} />
    </Svg>
  );
}
