import { Redirect, Tabs } from 'expo-router';

import { CosmicTabBar } from '@/components/CosmicTabBar';
import { useAuth } from '@/features/auth/SessionProvider';

/**
 * The five rooms of the universe (spec section 5):
 * Home, Self Love, Mikrokosmos, Trends, Me.
 */
export default function TabsLayout() {
  const { profile } = useAuth();

  // Auth guard: no member, no universe.
  if (!profile) return <Redirect href="/login" />;

  return (
    <Tabs
      tabBar={(props) => <CosmicTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="self-love" options={{ title: 'Self Love' }} />
      <Tabs.Screen name="mikrokosmos" options={{ title: 'Mikrokosmos' }} />
      <Tabs.Screen name="trends" options={{ title: 'Trends' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
    </Tabs>
  );
}
