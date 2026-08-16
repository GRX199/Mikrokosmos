import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/core/theme';

/** Section heading with optional action link. */
export function SectionTitle({
  title,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { theme, palette } = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.action}>
          {icon ? <Ionicons name={icon} size={14} color={theme.accent} /> : null}
          <Text style={[styles.actionLabel, { color: theme.accent }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
