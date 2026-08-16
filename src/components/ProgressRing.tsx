import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '@/core/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Cute circular progress ring used for calories / water / steps / score.
 */
export function ProgressRing({
  progress,
  size = 72,
  strokeWidth = 8,
  label,
  sublabel,
  color,
}: {
  /** 0..1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
}) {
  const { theme, palette } = useAppTheme();
  const ringColor = color ?? theme.primary;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  const animated = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(animated, {
      toValue: clamped,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [clamped, animated]);

  const strokeDashoffset = animated.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference}, ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        {label ? <Text style={[styles.label, { color: palette.text }]}>{label}</Text> : null}
        {sublabel ? (
          <Text style={[styles.sublabel, { color: palette.textSecondary }]}>{sublabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
  },
  sublabel: {
    fontSize: 9,
    marginTop: 1,
  },
});
