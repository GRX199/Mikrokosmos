import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useAuth } from '@/features/auth/SessionProvider';
import { ThemeProvider, useAppTheme } from '@/core/theme';
import { LoadingView } from '@/components/LoadingView';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout:
 *  - SessionProvider decides WHO is inside the universe.
 *  - ThemeProvider re-skins the whole app from that member's theme.
 *  - Auth redirects live in the screens themselves (expo-router pattern).
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
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
  const { theme } = useAppTheme();
  if (!ready) return <LoadingView />;
  return (
    <NavigationThemeProvider
      value={{
        dark: false,
        colors: {
          primary: theme.primary,
          background: theme.background,
          card: '#FFFFFF',
          text: '#2E2A3B',
          border: '#F0ECF7',
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
      <StatusBar style="dark" />
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
      </Stack>
    </NavigationThemeProvider>
  );
}
