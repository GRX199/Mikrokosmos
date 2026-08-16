import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SoftInput } from '@/components/SoftInput';
import { MAX_CONTENT_WIDTH, RADIUS, useAppTheme } from '@/core/theme';
import { useAuth } from '@/features/auth/SessionProvider';

/**
 * Welcome to Mikrokosmos — the front door of the universe (spec section 6).
 */
export default function LoginScreen() {
  const { profile, signIn, isMock } = useAuth();
  const { theme, palette } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already inside? Straight to Home.
  if (profile) return <Redirect href="/(tabs)" />;

  async function handleLogin() {
    setSubmitting(true);
    setError(null);
    const result = await signIn(username, password);
    if (result) setError(result);
    setSubmitting(false);
  }

  return (
    <LinearGradient
      colors={theme.gradient}
      style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            {/* Logo */}
            <View style={[styles.logoBubble, { backgroundColor: theme.light }]}>
              <Text style={styles.logoEmoji}>🌌</Text>
            </View>

            <Text style={[styles.title, { color: palette.text }]}>Welcome to Mikrokosmos</Text>
            <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
              Our little universe.
            </Text>

            {/* Form */}
            <View style={styles.form}>
              <SoftInput
                placeholder="Username"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
                returnKeyType="next"
              />
              <View style={styles.passwordRow}>
                <SoftInput
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  containerStyle={styles.flex}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={[styles.eyeButton, { backgroundColor: theme.light }]}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={theme.accent}
                  />
                </Pressable>
              </View>

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: palette.card }]}>
                  <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label="Enter Mikrokosmos ✨"
                onPress={handleLogin}
                loading={submitting}
                style={styles.loginButton}
              />

              {isMock ? (
                <Text style={[styles.mockNote, { color: palette.textFaint }]}>
                  Offline preview — sign in as namnamxyi, kyraawr or xcjessyx with any password.
                </Text>
              ) : null}
            </View>

            <Text style={[styles.tagline, { color: palette.textFaint }]}>
              A little universe shared by three best friends 💫
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  column: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH - 40,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
  },
  logoBubble: {
    width: 92,
    height: 92,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#8D6CCF',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  logoEmoji: {
    fontSize: 44,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 18,
  },
  form: {
    width: '100%',
    gap: 12,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eyeButton: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,138,155,0.4)',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  loginButton: {
    marginTop: 6,
  },
  mockNote: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  tagline: {
    fontSize: 12,
    marginTop: 26,
    textAlign: 'center',
  },
});
