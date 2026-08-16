import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH, RADIUS, useAppTheme } from '@/core/theme';

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  'self-love': 'heart',
  mikrokosmos: 'chatbubbles',
  trends: 'sparkles',
  me: 'person',
};

/**
 * Modern rounded floating bottom navigation (spec section 5).
 * Active tab glows in the member's theme color.
 */
export function CosmicTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme, palette } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        { bottom: Math.max(insets.bottom, 8) + (Platform.OS === 'web' ? 8 : 0) },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bar,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const focused = state.index === index;
          const icon = TAB_ICONS[route.name] ?? 'ellipse';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              style={[styles.tab, focused && { backgroundColor: theme.light }]}
            >
              <Ionicons
                name={icon}
                size={22}
                color={focused ? theme.accent : palette.textFaint}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: focused ? theme.accent : palette.textFaint },
                  focused && styles.labelActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  bar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH - 32,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#8D6CCF',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '800',
  },
});
