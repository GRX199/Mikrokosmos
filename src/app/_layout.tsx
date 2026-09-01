import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useAuth } from '@/features/auth/SessionProvider';
import { ThemeProvider, useAppTheme } from '@/core/theme';
import { I18nProvider } from '@/core/i18n/I18nProvider';
import { AppearanceProvider, useAppearanceMode } from '@/core/appearance/AppearanceProvider';
import { LoadingView } from '@/components/LoadingView';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout:
 *  - SessionProvider decides WHO is inside the universe.
 *  - I18nProvider + AppearanceProvider are device-level settings.
 *  - ThemeProvider re-skins the whole app from member theme + mode.
 *  - Auth redirects live in the screens themselves (expo-router pattern).
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <AppearanceProvider>
            <SessionProvider>
              <RootNavigator />
            </SessionProvider>
          </AppearanceProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { profile, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  return (
    <ThemeProvider themeKey={profile?.theme}>
      <AppStack ready={!isLoading} />
    </ThemeProvider>
  );
}

function AppStack({ ready }: { ready: boolean }) {
  const { theme, palette } = useAppTheme();
  const { mode } = useAppearanceMode();
  if (!ready) return <LoadingView />;

  return (
    <NavigationThemeProvider
      value={{
        dark: mode === 'dark',
        colors: {
          primary: theme.primary,
          background: theme.background,
          card: palette.card,
          text: palette.text,
          border: palette.border,
          notification: theme.primary,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: 'normal' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="friend/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="trend/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="memories" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="achievements" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="calendar" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="fan-mail" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
