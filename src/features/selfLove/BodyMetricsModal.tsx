import React, { useEffect, useState } from 'react';
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
import { SoftInput } from '@/components/SoftInput';
import { RADIUS, useAppTheme } from '@/core/theme';
import type { ActivityLevel, BodyMetrics, Sex, WeightGoal } from '@/models';
import { computeBodyInsights } from '@/services/bodyInsights';

/**
 * Body metrics setup sheet (Phase 2).
 * Height / weight / age / sex / activity / goal — everything stays private
 * (owner-only table). The preview recalculates live as she types.
 */

const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string; hint: string }[] = [
  { key: 'sedentary', label: 'Mostly sitting', hint: 'desk life 🌱' },
  { key: 'light', label: 'Lightly active', hint: 'walks & chores 🚶' },
  { key: 'moderate', label: 'Active', hint: 'exercise 3-5 days 🏃' },
  { key: 'active', label: 'Very active', hint: 'exercise 6-7 days 🔥' },
  { key: 'very_active', label: 'Athlete level', hint: 'intense daily training 🏆' },
];

const GOAL_OPTIONS: { key: WeightGoal; label: string; hint: string }[] = [
  { key: 'maintain', label: 'Maintain', hint: 'feel good as I am 🌿' },
  { key: 'lose_025', label: 'Gentle loss', hint: '−0.25 kg / week 🌸' },
  { key: 'lose_05', label: 'Steady loss', hint: '−0.5 kg / week 🌷' },
  { key: 'lose_075', label: 'Focused loss', hint: '−0.75 kg / week ✨' },
];

export function BodyMetricsModal({
  visible,
  metrics,
  onClose,
  onSave,
}: {
  visible: boolean;
  metrics: BodyMetrics | null;
  onClose: () => void;
  onSave: (patch: Partial<Omit<BodyMetrics, 'user_id'>>) => Promise<void>;
}) {
  const { theme, palette } = useAppTheme();

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('female');
  const [activity, setActivity] = useState<ActivityLevel>('light');
  const [goal, setGoal] = useState<WeightGoal>('maintain');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setHeight(metrics?.height_cm != null ? String(metrics.height_cm) : '');
    setWeight(metrics?.weight_kg != null ? String(metrics.weight_kg) : '');
    setAge(metrics?.age != null ? String(metrics.age) : '');
    setSex(metrics?.sex ?? 'female');
    setActivity(metrics?.activity_level ?? 'light');
    setGoal(metrics?.goal ?? 'maintain');
  }, [visible, metrics]);

  const preview = computeBodyInsights({
    user_id: '',
    height_cm: Number(height) || null,
    weight_kg: Number(weight) || null,
    age: Number(age) || null,
    sex,
    activity_level: activity,
    goal,
  });

  const valid =
    Number(height) >= 100 && Number(weight) >= 25 && Number(age) >= 10;

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        height_cm: Number(height) || null,
        weight_kg: Number(weight) || null,
        age: Number(age) || null,
        sex,
        activity_level: activity,
        goal,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: palette.overlay }]} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.sheetAnchor}>
          <RoundedCard style={styles.sheet}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: palette.text }]}>My Body 🌸</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={palette.textSecondary} />
              </Pressable>
            </View>
            <Text style={[styles.privacyNote, { color: palette.textFaint }]}>
              Only you can see these numbers — never your friends 💗
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
              {/* Numbers */}
              <SoftInput
                placeholder="Height (cm)"
                value={height}
                onChangeText={(t) => setHeight(t.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                containerStyle={styles.field}
              />
              <SoftInput
                placeholder="Weight (kg)"
                value={weight}
                onChangeText={(t) => setWeight(t.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                containerStyle={styles.field}
              />
              <SoftInput
                placeholder="Age"
                value={age}
                onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                containerStyle={styles.field}
              />

              {/* Sex */}
              <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>Body</Text>
              <View style={styles.chipRow}>
                {(['female', 'male'] as Sex[]).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setSex(option)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: sex === option ? theme.primary : palette.card,
                        borderColor: sex === option ? theme.primary : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: sex === option ? palette.white : palette.text },
                      ]}
                    >
                      {option === 'female' ? '♀ Female' : '♂ Male'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Activity */}
              <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>
                Daily activity
              </Text>
              <View style={styles.chipRow}>
                {ACTIVITY_OPTIONS.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => setActivity(option.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: activity === option.key ? theme.primary : palette.card,
                        borderColor: activity === option.key ? theme.primary : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: activity === option.key ? palette.white : palette.text },
                      ]}
                    >
                      {option.hint}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Goal */}
              <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>
                My gentle goal
              </Text>
              <View style={styles.chipRow}>
                {GOAL_OPTIONS.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => setGoal(option.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: goal === option.key ? theme.primary : palette.card,
                        borderColor: goal === option.key ? theme.primary : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: goal === option.key ? palette.white : palette.text },
                      ]}
                    >
                      {option.label} · {option.hint}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Live preview */}
              {preview.targetCalories ? (
                <View style={[styles.previewCard, { backgroundColor: theme.light }]}>
                  <Text style={[styles.previewTitle, { color: theme.accent }]}>
                    Your kind daily target ≈ {preview.targetCalories} kcal
                  </Text>
                  <Text style={[styles.previewRow, { color: palette.textSecondary }]}>
                    BMI {preview.bmi} · {preview.bmiEmoji} {preview.bmiLabel}
                  </Text>
                  <Text style={[styles.previewRow, { color: palette.textSecondary }]}>
                    BMR {preview.bmr} kcal · maintenance {preview.tdee} kcal
                  </Text>
                  {preview.estimatedDays ? (
                    <Text style={[styles.previewRow, { color: palette.textSecondary }]}>
                      Healthy range in ~{preview.estimatedDays} days at this gentle pace ✨
                    </Text>
                  ) : null}
                  {!preview.isHealthyDeficit ? (
                    <Text style={[styles.previewNote, { color: palette.textFaint }]}>
                      We keep your target safe — never below what your body needs.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <PrimaryButton
                label="Save My Body 💗"
                onPress={handleSave}
                disabled={!valid}
                loading={saving}
                style={styles.saveButton}
              />
              {!valid ? (
                <Text style={[styles.validNote, { color: palette.textFaint }]}>
                  Fill height, weight and age to unlock your smart target.
                </Text>
              ) : null}
            </ScrollView>
          </RoundedCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheetAnchor: { width: '100%', maxWidth: 520, padding: 12 },
  sheet: { maxHeight: '86%', padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, fontWeight: '800' },
  closeButton: { padding: 6 },
  privacyNote: { fontSize: 11.5, fontStyle: 'italic', marginTop: 4, marginBottom: 10 },
  body: { flexGrow: 0 },
  field: { marginBottom: 10 },
  sectionLabel: { fontSize: 12.5, fontWeight: '700', marginTop: 10, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: { fontSize: 12.5, fontWeight: '700' },
  previewCard: { borderRadius: RADIUS.md, padding: 14, marginTop: 14, gap: 3 },
  previewTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  previewRow: { fontSize: 12.5 },
  previewNote: { fontSize: 11, fontStyle: 'italic', marginTop: 6 },
  saveButton: { marginTop: 14, marginBottom: 6 },
  validNote: { fontSize: 11.5, fontStyle: 'italic', textAlign: 'center', marginTop: 6 },
});
