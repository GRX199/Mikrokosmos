/**
 * Cross-screen awareness: know when friends are active, gently.
 *
 * Subscribes to realtime activity + chat events (Supabase) or mock
 * emitters, and shows a soft IN-APP toast when something happens while
 * she's elsewhere in the app. Android local notifications only fire
 * when the app is backgrounded — never while she's actively using it
 * (no one likes being pinged about a chat they're reading).
 */

import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';

import type { Activity, ChatMessage } from '@/models';
import type { AppLanguage } from '@/core/i18n/I18nProvider';

export interface SocialEvent {
  kind: 'activity' | 'chat';
  actorName: string;
  actorId: string;
  text?: string; // activity text or chat message preview
  createdAt: string;
}

type Listener = (event: SocialEvent) => void;

const listeners = new Set<Listener>();

export function onSocialEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ── context: who am I + language (so we never ping about our own doings) ── */

let myProfileId = '';
let currentLang: AppLanguage = 'id';

export function setSocialContext(profileId: string, lang: AppLanguage): void {
  myProfileId = profileId;
  currentLang = lang;
}

/* ── AppState: notify only when backgrounded (Android) ─────────────────── */

let lastAppState: AppStateStatus = AppState.currentState;
let appStateReady = false;

export function initSocialAppState(): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    lastAppState = state;
  });
  appStateReady = true;
  return () => {
    sub.remove();
    appStateReady = false;
  };
}

export function isAppBackgrounded(): boolean {
  return lastAppState !== 'active';
}

/* ── copy ─────────────────────────────────────────────────────────────── */

const SOCIAL_COPY = {
  chat: {
    en: { title: 'New message 💌' },
    id: { title: 'Pesan baru 💌' },
  },
  activity: {
    en: { title: 'Your universe is glowing ✨' },
    id: { title: 'Semestamu berkilau ✨' },
  },
} as const;

/* ── event dispatch ───────────────────────────────────────────────────── */

export function handleSocialEvent(event: SocialEvent): void {
  if (event.actorId === myProfileId) return; // never about my own doings
  if (event.kind === 'chat') {
    // Skip if she's actively reading the chat right now.
    if (!isAppBackgrounded() && onChatScreen) return;
  }
  listeners.forEach((l) => l(event)); // in-app toast listeners
  maybeNotifyBackground(event);
}

let onChatScreen = false;

/** The chat screen flags itself visible so chat events become silent. */
export function setChatScreenVisible(visible: boolean): void {
  onChatScreen = visible;
}

async function maybeNotifyBackground(event: SocialEvent): Promise<void> {
  if (Platform.OS !== 'android' || !appStateReady) return;
  if (!isAppBackgrounded()) return; // in-app toast already covers foreground
  const copy = SOCIAL_COPY[event.kind][currentLang] ?? SOCIAL_COPY[event.kind].id;
  const preview = event.text ? `${event.actorName}: ${event.text}` : event.actorName;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `social.${event.kind}.${Date.now()}`,
      content: {
        title: copy.title,
        body: preview.length > 90 ? `${preview.slice(0, 87)}…` : preview,
      },
      trigger: null, // fire immediately
    });
  } catch {
    // no permission or scheduling failed — the in-app toast still shows
  }
}

/* ── emitters: called by repositories when something arrives ───────────── */

export function activityToSocialEvent(activity: Activity, actorName?: string): SocialEvent | null {
  if (!activity.user_id) return null;
  if (activity.is_bot) return null; // Miko's doings are not member activity
  return {
    kind: 'activity',
    actorId: activity.user_id,
    actorName: actorName ?? 'Someone',
    text: activity.text,
    createdAt: activity.created_at,
  };
}

export function messageToSocialEvent(message: ChatMessage): SocialEvent | null {
  if (message.is_bot) return null; // Miko speaks — no ping needed
  if (!message.sender_id) return null;
  return {
    kind: 'chat',
    actorId: message.sender_id,
    actorName: 'Someone', // caller resolves display name from profile list
    text: message.message,
    createdAt: message.created_at,
  };
}
