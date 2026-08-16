import React from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { RADIUS, useAppTheme } from '@/core/theme';

/** Rounded soft text input, focus-highlighted with the member's theme. */
export function SoftInput({
  style,
  containerStyle,
  ...props
}: TextInputProps & { containerStyle?: StyleProp<ViewStyle> }) {
  const { theme, palette } = useAppTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.card,
          borderColor: focused ? theme.primary : palette.border,
        },
        containerStyle,
      ]}
    >
      <TextInput
        placeholderTextColor={palette.textFaint}
        style={[styles.input, { color: palette.text }, style]}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    minHeight: 52,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    paddingVertical: 6,
    width: '100%',
  },
});
