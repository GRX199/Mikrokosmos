import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundedCard } from '@/components/RoundedCard';
import { MOODS, RADIUS, useAppTheme } from '@/core/theme';
import { nowTime } from '@/core/utils/date';
import type { Mood, Profile } from '@/models';

/**
 * Morning check-in popup (spec section 8): wake-up time (defaults to now)
 * + mood, shown once per day.
 */
export function MorningCheckinModal({
  visible,
  profile,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  profile: Profile;
  onSubmit: (wakeUpTime: string, mood: Mood) => Promise<void>;
  onClose?: () => void;
}) {
  const { theme, palette } = useAppTheme();
  const [wakeTime, setWakeTime] = useState(() => nowTime());
  const [hour, minute] = wakeTime.split(':').map(Number);
  const [mood, setMood] = useState<Mood | null>(null);
  const [saving, setSaving] = useState(false);

  function shiftTime(deltaMinutes: number) {
    const total = ((hour * 60 + minute + deltaMinutes) + 1440) % 1440;
    const h = `${Math.floor(total / 60)}`.padStart(2, '0');
    const m = `${total % 60}`.padStart(2, '0');
    setWakeTime(`${h}:${m}`);
  }

  async function handleSubmit() {
    if (!mood) return;
    setSaving(true);
    try {
      await onSubmit(wakeTime, mood);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: palette.overlay }]}>
        <View style={styles.sheetWrap}>
          <RoundedCard style={styles.sheet}>
            {/* Close button */}
            {onClose ? (
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={22} color={palette.textSecondary} />
              </Pressable>
            ) : null}
            <Text style={styles.bigEmoji}>☀️</Text>
            <Text style={[styles.title, { color: palette.text }]}>
              Good morning, {profile.display_name}
            </Text>
            <Text style={[styles.question, { color: palette.textSecondary }]}>
              What time did you wake up today?
            </Text>

            {/* Wake-up time stepper */}
            <View style={[styles.timeRow, { backgroundColor: theme.light }]}>
              <Pressable style={styles.timeArrow} onPress={() => shiftTime(-15)}>
                <Text style={[styles.timeArrowText, { color: theme.accent }]}>−15</Text>
              </Pressable>
              <Text style={[styles.timeText, { color: theme.accent }]}>{wakeTime}</Text>
              <Pressable style={styles.timeArrow} onPress={() => shiftTime(15)}>
                <Text style={[styles.timeArrowText, { color: theme.accent }]}>+15</Text>
              </Pressable>
            </View>

            <Text style={[styles.question, { color: palette.textSecondary, marginTop: 18 }]}>
              How are you feeling today?
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRow}>
              {MOODS.map((option) => {
                const selected = mood === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setMood(option.key)}
                    style={[
                      styles.moodChip,
                      {
                        backgroundColor: selected ? theme.primary : palette.card,
                        borderColor: selected ? theme.primary : palette.border,
                      },
                    ]}
                  >
                    <Text style={styles.moodEmoji}>{option.emoji}</Text>
                    <Text
                      style={[
                        styles.moodLabel,
                        { color: selected ? palette.white : palette.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <PrimaryButton
              label="Start My Day ✨"
              onPress={handleSubmit}
              disabled={!mood}
              loading={saving}
              style={styles.submit}
            />
          </RoundedCard>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheetWrap: {
    width: '100%',
    maxWidth: 480,
  },
  sheet: {
    alignItems: 'center',
    padding: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  bigEmoji: {
    fontSize: 42,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
  question: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    marginTop: 14,
    alignSelf: 'stretch',
    paddingVertical: 8,
  },
  timeArrow: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  timeArrowText: {
    fontSize: 15,
    fontWeight: '800',
  },
  timeText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '800',
  },
  moodRow: {
    gap: 10,
    paddingVertical: 6,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  moodEmoji: {
    fontSize: 17,
  },
  moodLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  submit: {
    alignSelf: 'stretch',
    marginTop: 18,
  },
});
