import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/core/theme';
import { PrimaryButton } from './PrimaryButton';

/** Beautiful empty state (spec section 44). */
export function EmptyState({
  emoji,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { palette } = useAppTheme();
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 8,
  },
  emoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 12,
  },
});
