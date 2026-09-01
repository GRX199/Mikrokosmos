/**
 * Local notifications — the gentle nudge layer.
 *
 * Philosophy: reminders are KIND, never pushy. Water sips, gentle check-in
 * if the day started quiet, meal-photo nudges — all local (no push server
 * needed), all cancellable, and nothing fires while she's active in the app.
 *
 * Android 13+ asks for POST_NOTIFICATIONS permission on first schedule.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import type { AppLanguage } from '@/core/i18n/I18nProvider';

export type NotifKind =
  | 'morning_checkin' // "start your day" if no check-in yet
  | 'water_early' // halfway water nudge
  | 'water_goal' // one glass left
  | 'meal_photo' // dinner-time "log your meal ✨"
  | 'fan_mail'; // a fan letter is waiting

let configured = false;
let permissionAsked = false;

/** How the notification behaves when it fires (foreground = in-app banner). */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Ask for permission (Android 13+ / iOS). Returns true if we may notify. */
export async function ensurePermission(): Promise<boolean> {
  await configureNotifications();
  if (permissionAsked) {
    const current = await Notifications.getPermissionsAsync();
    return current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  permissionAsked = true;
  const settings = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: false },
  });
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

interface NudgeCopy {
  title: string;
  body: string;
}

const COPY: Record<NotifKind, Record<AppLanguage, NudgeCopy>> = {
  morning_checkin: {
    en: { title: 'Good morning ☀️', body: 'Your universe is waiting — how did you wake up today?' },
    id: { title: 'Selamat pagi ☀️', body: 'Semestamu menunggu — bagaimana bangun tidurmu hari ini?' },
  },
  water_early: {
    en: { title: 'Little sip? 💧', body: 'Halfway to your water goal — one glass at a time.' },
    id: { title: 'Seruput kecil? 💧', body: 'Setengah jalan menuju target airmu — satu gelas satu gelas.' },
  },
  water_goal: {
    en: { title: 'Almost there 💧', body: 'Just one more glass and your water goal blooms 🌷' },
    id: { title: 'Sedikit lagi 💧', body: 'Satu gelas lagi dan target airmu mekar 🌷' },
  },
  meal_photo: {
    en: { title: 'Meal time snapshot 🍱', body: 'Snap your meal — Miko loves guessing what’s inside ✨' },
    id: { title: 'Jepret makananmu 🍱', body: 'Foto makananmu — Miko suka menebak isinya ✨' },
  },
  fan_mail: {
    en: { title: 'Fan mail has arrived 💌', body: 'A fan wrote you a little letter — open it when you feel like it.' },
    id: { title: 'Surat fans datang 💌', body: 'Seorang fans menulis surat kecil untukmu — buka kapan saja kamu siap.' },
  },
};

/** Schedule a gentle nudge. Local only; silently skipped if no permission. */
export async function scheduleNudge(
  kind: NotifKind,
  lang: AppLanguage = 'id',
  at: Date,
  options?: { repeats?: boolean }
): Promise<string | null> {
  const allowed = await ensurePermission();
  if (!allowed) return null;
  const copy = COPY[kind][lang] ?? COPY[kind].id;

  // Cancel any previous nudge of the same kind before rescheduling.
  await cancelNudge(kind);

  const id = await Notifications.scheduleNotificationAsync({
    identifier: `nudge.${kind}`,
    content: { title: copy.title, body: copy.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
    },
  });
  return id;
}

/** Remove a pending nudge (e.g. she already checked in). */
export async function cancelNudge(kind: NotifKind): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`nudge.${kind}`);
  } catch {
    // not scheduled — fine
  }
}

/** React to a nudge tap: navigate into the right tab. */
export function nudgeRoute(kind: NotifKind): string {
  switch (kind) {
    case 'morning_checkin':
      return '/'; // Home shows the check-in card
    case 'water_early':
    case 'water_goal':
    case 'meal_photo':
      return '/self-love';
    case 'fan_mail':
      return '/fan-mail';
  }
}

/** Wire nudge taps to navigation. Call once from the root layout. */
export function bindNudgeNavigation(navigate: (path: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const id = response.notification.request.identifier;
    if (id.startsWith('nudge.')) {
      const kind = id.replace('nudge.', '') as NotifKind;
      if (COPY[kind]) navigate(nudgeRoute(kind));
    }
  });
  return () => sub.remove();
}

export const isAndroid = Platform.OS === 'android';
