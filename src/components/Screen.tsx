import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH, useAppTheme } from '@/core/theme';

/**
 * Screen — themed page background + centered content column so pages
 * never stretch endlessly on web/tablet (spec section 46).
 */
export function Screen({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }, style]}>
      <View style={[styles.content, padded && styles.padded]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  padded: {
    paddingHorizontal: 20,
  },
});
