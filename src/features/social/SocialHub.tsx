/**
 * SocialHub — one global subscription point for friends' doings.
 *
 * Sits above the navigation stack (root layout). Subscribes to:
 *   • activities realtime → other members' doings (check-in, goals…)
 *   • chat realtime       → new messages from members (not Miko)
 *
 * Foreground: soft toast, top of the screen, auto-dismiss, tappable →
 * navigates to the right screen. Backgrounded (Android): local
 * notification instead. Never pings about your own doings, and never
 * pings about chat while you're reading the chat screen.
 */

import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/core/i18n';
import { useAppTheme } from '@/core/theme';
import { useAuth } from '@/features/auth/SessionProvider';
import { subscribeToActivities } from '@/repositories/activities';
import { subscribeToMessages } from '@/repositories/chat';
import { fetchProfiles } from '@/repositories/profiles';
import {
  activityToSocialEvent,
  handleSocialEvent,
  initSocialAppState,
  messageToSocialEvent,
  onSocialEvent,
  setChatScreenVisible,
  setSocialContext,
  type SocialEvent,
} from '@/services/social';

interface ToastState {
  event: SocialEvent;
  hideAt: number;
}

const TOAST_MS = 4200;

export function SocialHub({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { theme, palette } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();
  const { language } = useI18n();

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Who am I + language for the social layer.
  useEffect(() => {
    if (profile) setSocialContext(profile.id, language);
  }, [profile, language]);

  // Track whether the chat screen is the active route.
  const isChatRoute = pathname === '/mikrokosmos';
  useEffect(() => {
    setChatScreenVisible(isChatRoute);
  }, [isChatRoute]);

  // AppState (background detection) + global realtime subscriptions.
  useEffect(() => {
    const disposeAppState = initSocialAppState();

    // Profiles cached once to resolve actor names (realtime rows only carry ids).
    let profilesById = new Map<string, string>();
    fetchProfiles()
      .then((all) => {
        profilesById = new Map(all.map((p) => [p.id, p.display_name]));
      })
      .catch(() => undefined);

    const nameOf = (id: string) => profilesById.get(id);

    const disposeActivities = subscribeToActivities((activity) => {
      const evt = activityToSocialEvent(activity, nameOf(activity.user_id ?? ''));
      if (evt) handleSocialEvent(evt);
    });

    const disposeChat = subscribeToMessages((message) => {
      const evt = messageToSocialEvent(message);
      if (evt) {
        evt.actorName = nameOf(evt.actorId) ?? evt.actorName;
        handleSocialEvent(evt);
      }
    });

    return () => {
      disposeAppState();
      disposeActivities();
      disposeChat();
    };
  }, []);

  // Listen for toast-worthy events (foreground, not self, not chat-while-reading).
  const [toastTick, setToastTick] = useState(0);
  useEffect(() => {
    const dispose = onSocialEvent((event) => {
      setToast({ event, hideAt: Date.now() + TOAST_MS });
      setToastTick((n) => n + 1);
    });
    return dispose;
  }, []);

  // Auto-dismiss timer.
  useEffect(() => {
    if (!toast) return;
    Animated.timing(toastAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => {
        setToast(null);
      });
    }, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, toastTick, toastAnim]);

  const openTarget = (event: SocialEvent): string => (event.kind === 'chat' ? '/mikrokosmos' : '/');

  return (
    <View style={styles.hub}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.toastWrap,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            onPress={() => {
              const target = openTarget(toast.event);
              setToast(null);
              router.push(target as Parameters<typeof router.push>[0]);
            }}
            style={[styles.toast, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <Ionicons
              name={toast.event.kind === 'chat' ? 'chatbubbles' : 'sparkles'}
              size={20}
              color={theme.primary}
              style={{ marginTop: 2 }}
            />
            <View style={styles.toastBody}>
              <Text style={[styles.toastTitle, { color: palette.text }]} numberOfLines={1}>
                {toast.event.kind === 'chat'
                  ? `${t('New message from')} ${toast.event.actorName}`
                  : `${toast.event.actorName} ${t('is glowing')}`}
              </Text>
              {toast.event.text ? (
                <Text style={[styles.toastText, { color: palette.textSecondary }]} numberOfLines={2}>
                  {toast.event.text}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

/* Toast subscription reuses the social listener set with a toast-only filter. */
const styles = StyleSheet.create({
  hub: { flex: 1 },
  toastWrap: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    // RN 0.86 web: boxShadow replaces the deprecated shadow* props.
    boxShadow: '0px 6px 18px rgba(0,0,0,0.14)',
    elevation: 8,
  },
  toastBody: { flexShrink: 1 },
  toastTitle: { fontSize: 13.5, fontWeight: '800' },
  toastText: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
});
