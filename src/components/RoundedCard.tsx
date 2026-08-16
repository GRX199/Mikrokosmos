import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { RADIUS, useAppTheme } from '@/core/theme';

/** Soft white card with rounded corners + gentle shadow — the base surface. */
export function RoundedCard({
  children,
  style,
  tinted = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tinted cards use the member's light color instead of white. */
  tinted?: boolean;
}) {
  const { theme, palette } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tinted ? theme.light : palette.card, borderColor: palette.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Gradient hero card used for greetings / celebrations. */
export function GradientCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useAppTheme();
  return (
    <LinearGradient
      colors={theme.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: 'transparent' }, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#8D6CCF',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
});
