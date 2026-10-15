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
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
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
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
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
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
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
