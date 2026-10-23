import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { color } from './tokens';

type LandscapeProps = {
  /**
   * `home`: mist gradient at the top and two mountain ridges at the bottom.
   * `mist`: a thin mist gradient only (every other screen).
   */
  variant?: 'home' | 'mist';
};

const MIST_HEIGHT = { home: 160, mist: 72 } as const;
const MOUNTAIN_HEIGHT = 150;

/**
 * Decorative 山水 backdrop. Drawn behind the content, never focusable and never
 * intercepting touches. Static in M0.
 */
export function Landscape({ variant = 'home' }: LandscapeProps) {
  const gradientId = `mist-${variant}`;
  return (
    <View
      testID={`landscape-${variant}`}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      // Decorative: hidden from screen readers without the `accessible` false prop, which
      // react-native-web would pass to the DOM (M6-beginner-friendly AC 43).
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height={MIST_HEIGHT[variant]} style={styles.mist}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.sky} stopOpacity="1" />
            <Stop offset="1" stopColor={color.background} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      {variant === 'home' ? (
        <Svg
          width="100%"
          height={MOUNTAIN_HEIGHT}
          viewBox="0 0 360 150"
          preserveAspectRatio="none"
          style={styles.mountains}
        >
          <Path
            d="M0 70 C40 40 70 30 110 55 C140 72 160 35 200 25 C240 15 270 50 300 45 C330 40 345 55 360 50 L360 150 L0 150 Z"
            fill={color.mountainFar}
          />
          <Path
            d="M0 110 C30 90 60 80 95 95 C130 110 150 75 190 78 C230 82 250 105 290 98 C320 92 340 100 360 96 L360 150 L0 150 Z"
            fill={color.mountainNear}
            opacity={0.85}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mist: { position: 'absolute', top: 0, left: 0, right: 0 },
  mountains: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
