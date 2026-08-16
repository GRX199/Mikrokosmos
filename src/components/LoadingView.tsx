import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/core/theme';
import { PrimaryButton } from './PrimaryButton';

/** Soft pulsing loader — never a blank page (spec section 45). */
export function LoadingView({ label = 'Opening your universe…' }: { label?: string }) {
  const { theme, palette } = useAppTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.orb,
          { backgroundColor: theme.primary, opacity: pulse },
        ]}
      />
      <ActivityIndicator color={theme.accent} style={styles.spinner} />
      <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

/** Error state with retry (spec section 45). */
export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { palette } = useAppTheme();
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>🛰️</Text>
      <Text style={[styles.title, { color: palette.text }]}>Signal lost</Text>
      <Text style={[styles.message, { color: palette.textSecondary }]}>
        {message ?? 'Something drifted out of orbit. Try again?'}
      </Text>
      {onRetry ? <PrimaryButton label="Try again" onPress={onRetry} variant="soft" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  orb: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  spinner: {
    marginTop: 14,
  },
  label: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  emoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
});
