import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RoundedCard } from '@/components/RoundedCard';
import { mealMeta, RADIUS, useAppTheme } from '@/core/theme';
import { formatNumber, shortTime } from '@/core/utils/date';
import type { Meal } from '@/models';
import { fetchMealById } from '@/repositories/meals';
import { resolveMediaUrl } from '@/repositories/storage';

/**
 * Modal that shows meal details (name, calories, components, photo).
 * Used when clicking a meal activity in the Recent Activity feed.
 * If mealId is null, shows activityText as fallback.
 */
export function MealDetailModal({
  mealId,
  activityText,
  visible,
  onClose,
}: {
  mealId: string | null;
  activityText?: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme, palette } = useAppTheme();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !mealId) {
      setMeal(null);
      setImageUrl(null);
      return;
    }
    setLoading(true);
    fetchMealById(mealId)
      .then(async (m) => {
        setMeal(m);
        if (m?.image_url) {
          const url = await resolveMediaUrl(m.image_url);
          setImageUrl(url);
        }
      })
      .finally(() => setLoading(false));
  }, [visible, mealId]);

  if (!visible) return null;

  // Fallback display when no meal data is available
  const displayName = meal?.meal_name ?? activityText ?? 'Meal Details';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.overlayInner}>
          <RoundedCard style={[styles.card, { backgroundColor: palette.card }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerEmoji]}>
                {meal ? mealMeta(meal.meal_type).emoji : '🍱'}
              </Text>
              <View style={styles.flex}>
                <Text style={[styles.title, { color: palette.text }]}>
                  {loading ? 'Loading...' : displayName}
                </Text>
                {meal ? (
                  <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                    {mealMeta(meal.meal_type).label} · {shortTime(meal.meal_time)}
                  </Text>
                ) : activityText ? (
                  <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                    Meal activity
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={palette.textSecondary} />
              </Pressable>
            </View>

            {/* Photo */}
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.photo}
                resizeMode="cover"
              />
            ) : null}

            {/* Details */}
            {meal ? (
              <ScrollView style={styles.details} showsVerticalScrollIndicator={false}>
                {/* Calories */}
                {meal.calories != null ? (
                  <View style={[styles.detailRow, { borderBottomColor: palette.border }]}>
                    <Ionicons name="flame" size={20} color={theme.accent} />
                    <Text style={[styles.detailLabel, { color: palette.text }]}>Calories</Text>
                    <Text style={[styles.detailValue, { color: theme.accent }]}>
                      {formatNumber(meal.calories)} kcal
                    </Text>
                  </View>
                ) : null}

                {/* Notes */}
                {meal.notes ? (
                  <View style={[styles.detailRow, { borderBottomColor: palette.border }]}>
                    <Ionicons name="document-text" size={20} color={palette.textSecondary} />
                    <Text style={[styles.detailLabel, { color: palette.text }]}>Notes</Text>
                    <Text style={[styles.detailValue, { color: palette.textSecondary }]} numberOfLines={3}>
                      {meal.notes}
                    </Text>
                  </View>
                ) : null}

                {/* Disclaimer */}
                <Text style={[styles.disclaimer, { color: palette.textFaint }]}>
                  ✨ Estimates may vary. Food is fuel and joy — no judgment here.
                </Text>
              </ScrollView>
            ) : !loading ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyEmoji]}>🍱</Text>
                <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
                  {activityText ? 'Meal logged' : 'Meal details not available'}
                </Text>
                {!activityText ? (
                  <Text style={[styles.emptySubtext, { color: palette.textFaint }]}>
                    This meal was logged before detailed tracking was enabled.
                  </Text>
                ) : null}
                <Text style={[styles.disclaimer, { color: palette.textFaint }]}>
                  ✨ Estimates may vary. Food is fuel and joy — no judgment here.
                </Text>
              </View>
            ) : null}
          </RoundedCard>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayInner: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  headerEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  photo: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  details: {
    padding: 16,
    maxHeight: 300,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: '50%',
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
