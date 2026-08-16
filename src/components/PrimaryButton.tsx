import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { RADIUS, useAppTheme } from '@/core/theme';

/** Rounded primary button, colored by the member's theme. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
  variant = 'filled',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  /** filled = theme background; soft = light tint with accent text. */
  variant?: 'filled' | 'soft';
}) {
  const { theme, palette } = useAppTheme();
  const filled = variant === 'filled';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: filled ? theme.primary : theme.light,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={filled ? palette.white : theme.accent} />
      ) : (
        <Text style={[styles.label, { color: filled ? palette.white : theme.accent }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
});
