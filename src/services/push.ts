/**
 * Server push registration (FCM via Expo push service).
 *
 * When the app logs in on a device, we register that install's Expo push
 * token in Supabase. A database trigger then calls the notify-chat-push
 * edge function on every new chat message, which sends the notification
 * through Google's FCM — so it arrives even if the app was swiped away.
 *
 * Philosophy, unchanged: notifications are gentle. When the app IS running
 * and the chat screen is visible, the notification handler suppresses the
 * banner (the realtime toast already showed it). Only backgrounded or
 * killed installs see a system notification.
 *
 * expo-notifications is loaded LAZILY for the same reason as nudges.ts:
 * its top-level side effects print a warning on web.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';

type NotificationsModule = typeof import('expo-notifications');

const isNative = Platform.OS === 'android' || Platform.OS === 'ios';
let mod: NotificationsModule | null = null;

function notifications(): NotificationsModule | null {
  if (!isNative) return null;
  if (!mod) mod = require('expo-notifications') as NotificationsModule;
  return mod;
}

/** Human-readable device label for the tokens table. */
function platformLabel(): string {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

/**
 * Register this install for push after login. Safe to call repeatedly —
 * upsert keyed on the token itself. Returns the token or null (web,
 * no permission, or Supabase not configured).
 */
export async function registerForPush(userId: string): Promise<string | null> {
  const N = notifications();
  if (!N || !isSupabaseConfigured) return null;

  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('chat', {
        name: 'Pesan sahabat',
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 120, 60, 120],
        lightColor: '#B79CED',
        lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
      });
    }

    const granted = await N.requestPermissionsAsync();
    if (!granted.granted && !granted.canAskAgain) return null;

    // SDK 53+: getExpoPushTokenAsync requires projectId (EAS). It lives in
    // app.json → extra.eas.projectId, which expo-constants exposes at runtime.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants.easConfigId as unknown as string | undefined); // dev client fallback
    if (!projectId) {
      console.warn('[push] no EAS projectId — cannot register for push');
      return null;
    }

    const token = (
      await N.getExpoPushTokenAsync({ projectId })
    ).data;
    if (!token) return null;

    await getSupabase().from('push_tokens').upsert(
      {
        token,
        user_id: userId,
        platform: platformLabel(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );

    return token;
  } catch {
    // Push is optional — never let it break login.
    return null;
  }
}

/**
 * Remove this device's token on logout (so a logged-out install never
 * receives chat notifications).
 */
export async function unregisterPush(token: string | null): Promise<void> {
  if (!token || !isSupabaseConfigured) return;
  try {
    await getSupabase().from('push_tokens').delete().eq('token', token);
  } catch {
    // best-effort
  }
}

// ─── Foreground suppression ────────────────────────────────────────────────
// The chat screen sets this when it's on top. The global notification
// handler checks it so an incoming PUSH doesn't double up with the
// realtime toast that already showed the same message.

let chatVisible = false;

export function setPushChatVisible(visible: boolean): void {
  chatVisible = visible;
}

export function isPushChatVisible(): boolean {
  return chatVisible;
}

// ─── Notification response (tap) ──────────────────────────────────────────
// Set at app start: tapping the notification jumps to the chat tab.

let responseListener: { remove(): void } | null = null;

export function bindPushResponseNavigation(onOpen: () => void): void {
  const N = notifications();
  if (!N || responseListener) return;

  responseListener = N.addNotificationResponseReceivedListener(() => {
    onOpen();
  });

  // Also handle the "app was killed, user tapped notification to open" case:
  // getLastNotificationResponseAsync fires on mount when the app was opened
  // from a notification.
  N.getLastNotificationResponseAsync?.().then((response) => {
    if (response) onOpen();
  });
}

/**
 * Should a notification be shown right now?
 * Push chat notifications are hidden when the chat screen is visible —
 * the realtime toast already told her.
 */
export function shouldShowPushNotification(): boolean {
  return !chatVisible;
}
