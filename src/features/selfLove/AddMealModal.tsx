import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundedCard } from '@/components/RoundedCard';
import { SoftInput } from '@/components/SoftInput';
import { MEAL_TYPES, RADIUS, useAppTheme } from '@/core/theme';
import { nowTime } from '@/core/utils/date';
import type { Meal, MealType } from '@/models';
import type { MealInput } from '@/repositories/meals';
import { analyzeFoodPhoto, type FoodAnalysis } from '@/services/calorieAnalyzer';

/**
 * Add / edit meal sheet (spec sections 12 + 13).
 * Includes the AI food recognition flow — mocked until a vision API
 * is configured, with an explicit "estimates" disclaimer.
 */
export function AddMealModal({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial?: Meal | null;
  onClose: () => void;
  onSave: (input: MealInput, localImageUri: string | null) => Promise<void>;
}) {
  const { theme, palette } = useAppTheme();

  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [time, setTime] = useState(nowTime());
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset / prefill when opening.
  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setMealType(initial.meal_type);
      setName(initial.meal_name);
      setCalories(initial.calories != null ? String(initial.calories) : '');
      setNotes(initial.notes ?? '');
      setTime(initial.meal_time.slice(0, 5));
      setImageUri(initial.image_url ?? null);
    } else {
      setMealType('breakfast');
      setName('');
      setCalories('');
      setNotes('');
      setTime(nowTime());
      setImageUri(null);
    }
    setAnalysis(null);
  }, [visible, initial]);

  async function pickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setAnalysis(null);
      }
    } catch {
      // Photo picking is optional — never block logging.
    }
  }

  async function runAnalysis() {
    if (!imageUri) return;
    setAnalyzing(true);
    try {
      const result = await analyzeFoodPhoto(imageUri);
      setAnalysis(result);
      setName(result.mealName);
      setCalories(String(result.totalCalories));
    } finally {
      setAnalyzing(false);
    }
  }

  function shiftTime(deltaMinutes: number) {
    const [h, m] = time.split(':').map(Number);
    const total = ((h * 60 + m + deltaMinutes) + 1440) % 1440;
    setTime(
      `${`${Math.floor(total / 60)}`.padStart(2, '0')}:${`${total % 60}`.padStart(2, '0')}`
    );
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(
        {
          meal_type: mealType,
          meal_name: name.trim(),
          calories: calories ? Math.max(0, Number(calories) || 0) : null,
          notes: notes.trim() || null,
          meal_time: time,
        },
        imageUri
      );
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
              <Text style={[styles.title, { color: palette.text }]}>
                {initial ? 'Edit Meal' : 'Add Meal 🍱'}
              </Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={palette.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
              {/* Meal type */}
              <View style={styles.typeRow}>
                {MEAL_TYPES.map((option) => {
                  const selected = mealType === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setMealType(option.key)}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: selected ? theme.primary : palette.card,
                          borderColor: selected ? theme.primary : palette.border,
                        },
                      ]}
                    >
                      <Text style={styles.typeEmoji}>{option.emoji}</Text>
                      <Text
                        style={[
                          styles.typeLabel,
                          { color: selected ? palette.white : palette.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Photo + AI */}
              <View style={styles.photoRow}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                ) : (
                  <Pressable
                    onPress={pickPhoto}
                    style={[styles.photoPlaceholder, { backgroundColor: theme.light }]}
                  >
                    <Ionicons name="camera-outline" size={26} color={theme.accent} />
                    <Text style={[styles.photoPlaceholderText, { color: theme.accent }]}>
                      Add photo
                    </Text>
                  </Pressable>
                )}
                <View style={styles.photoActions}>
                  <PrimaryButton
                    label={imageUri ? 'Change photo' : 'Pick a photo'}
                    onPress={pickPhoto}
                    variant="soft"
                    style={styles.photoButton}
                  />
                  {imageUri ? (
                    <PrimaryButton
                      label={analyzing ? 'Analyzing…' : '✨ Estimate calories'}
                      onPress={runAnalysis}
                      loading={analyzing}
                      style={styles.photoButton}
                    />
                  ) : null}
                </View>
              </View>

              {analysis ? (
                <View style={[styles.analysisCard, { backgroundColor: theme.light }]}>
                  <Text style={[styles.analysisTitle, { color: theme.accent }]}>
                    {analysis.mealName} · ≈ {analysis.totalCalories} kcal
                  </Text>
                  {analysis.components.map((part) => (
                    <View key={part.name} style={styles.analysisRow}>
                      <Text style={[styles.analysisPart, { color: palette.text }]}>{part.name}</Text>
                      <Text style={[styles.analysisKcal, { color: palette.textSecondary }]}>
                        {part.calories} kcal
                      </Text>
                    </View>
                  ))}
                  <Text style={[styles.disclaimer, { color: palette.textFaint }]}>
                    Calories are estimates and may not be exact.
                  </Text>
                </View>
              ) : null}

              {/* Fields */}
              <SoftInput
                placeholder="Meal name"
                value={name}
                onChangeText={setName}
                containerStyle={styles.field}
              />
              <SoftInput
                placeholder="Calories (optional)"
                value={calories}
                onChangeText={(text) => setCalories(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                containerStyle={styles.field}
              />
              <SoftInput
                placeholder="Notes (optional)"
                value={notes}
                onChangeText={setNotes}
                containerStyle={styles.field}
              />

              {/* Time */}
              <View style={[styles.timeRow, { backgroundColor: theme.light }]}>
                <Pressable onPress={() => shiftTime(-15)} style={styles.timeArrow}>
                  <Text style={[styles.timeArrowText, { color: theme.accent }]}>−15</Text>
                </Pressable>
                <Text style={[styles.timeText, { color: theme.accent }]}>{time}</Text>
                <Pressable onPress={() => shiftTime(15)} style={styles.timeArrow}>
                  <Text style={[styles.timeArrowText, { color: theme.accent }]}>+15</Text>
                </Pressable>
              </View>

              <PrimaryButton
                label={initial ? 'Save changes' : 'Save Meal 💗'}
                onPress={handleSave}
                disabled={!name.trim()}
                loading={saving}
                style={styles.saveButton}
              />
            </ScrollView>
          </RoundedCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetAnchor: {
    width: '100%',
    maxWidth: 520,
    padding: 12,
  },
  sheet: {
    maxHeight: '86%',
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
  },
  closeButton: {
    padding: 6,
  },
  body: {
    flexGrow: 0,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeEmoji: {
    fontSize: 14,
  },
  typeLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  photoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  photoPreview: {
    width: 86,
    height: 86,
    borderRadius: RADIUS.md,
  },
  photoPlaceholder: {
    width: 86,
    height: 86,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoPlaceholderText: {
    fontSize: 11,
    fontWeight: '700',
  },
  photoActions: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  photoButton: {
    minHeight: 40,
    paddingVertical: 8,
  },
  analysisCard: {
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 14,
    gap: 4,
  },
  analysisTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  analysisPart: {
    fontSize: 13,
  },
  analysisKcal: {
    fontSize: 13,
  },
  disclaimer: {
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },
  field: {
    marginBottom: 10,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    paddingVertical: 4,
    marginBottom: 14,
  },
  timeArrow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  timeArrowText: {
    fontSize: 13,
    fontWeight: '800',
  },
  timeText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
  },
  saveButton: {
    marginBottom: 6,
  },
});
