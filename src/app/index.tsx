import { Redirect } from 'expo-router';

import { LoadingView } from '@/components/LoadingView';
import { useAuth } from '@/features/auth/SessionProvider';

/** Root route — sends members to login or straight into their universe. */
export default function Index() {
  const { isLoading, profile } = useAuth();
  if (isLoading) return <LoadingView />;
  return <Redirect href={profile ? '/(tabs)' : '/login'} />;
}
