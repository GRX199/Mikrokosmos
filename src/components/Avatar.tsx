import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { themeFor, useAppTheme } from '@/core/theme';
import type { Profile, UserThemeKey } from '@/models';

/** Emoji avatar bubble colored with the member's own theme. */
export function Avatar({
  profile,
  themeKey,
  emoji,
  size = 44,
}: {
  profile?: Profile | null;
  themeKey?: UserThemeKey;
  emoji?: string;
  size?: number;
}) {
  const { palette } = useAppTheme();
  const key = themeKey ?? profile?.theme;
  const theme = themeFor(key);
  const symbol = emoji ?? profile?.emoji ?? '✨';
  return (
    <View
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.light,
          borderColor: palette.border,
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.48 }}>{symbol}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
