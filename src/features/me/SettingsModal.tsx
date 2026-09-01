import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { RoundedCard } from '@/components/RoundedCard';
import { RADIUS, useAppTheme } from '@/core/theme';
import { useAppearanceMode } from '@/core/appearance/AppearanceProvider';
import { useI18n, type AppLanguage } from '@/core/i18n/I18nProvider';

/**
 * Settings sheet — app language (EN/ID) + appearance (light/dark).
 * Choices persist per-device and apply instantly.
 */
export function SettingsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { theme, palette } = useAppTheme();
  const { t, language, setLanguage } = useI18n();
  const { mode, setMode, followsSystem } = useAppearanceMode();
  const [langAnim, setLangAnim] = useState(0); // re-render pulse

  if (!visible) return null;

  const languages: { key: AppLanguage; label: string; flag: string }[] = [
    { key: 'en', label: 'English', flag: '🌍' },
    { key: 'id', label: 'Indonesia', flag: '🇮🇩' },
  ];

  const modes: { key: 'light' | 'dark'; label: string; icon: string }[] = [
    { key: 'light', label: t('Light'), icon: 'sunny-outline' },
    { key: 'dark', label: t('Dark'), icon: 'moon-outline' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <RoundedCard style={[styles.card, { backgroundColor: palette.card }]} tinted={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerEmoji]}>⚙️</Text>
              <View style={styles.flex}>
                <Text style={[styles.title, { color: palette.text }]}>
                  {t('App Language & Theme')}
                </Text>
                <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                  {t('Choose your vibe')}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={palette.textSecondary} />
              </Pressable>
            </View>

            {/* Language */}
            <Text style={[styles.sectionLabel, { color: palette.textFaint }]}>
              {t('Language')}
            </Text>
            <View style={styles.segmentRow}>
              {languages.map((l) => {
                const active = language === l.key;
                return (
                  <Pressable
                    key={l.key}
                    onPress={() => {
                      setLanguage(l.key);
                      setLangAnim((n) => n + 1);
                    }}
                    style={[
                      styles.segment,
                      { borderColor: active ? theme.primary : palette.border },
                      active && { backgroundColor: theme.light },
                    ]}
                  >
                    <Text style={styles.segmentEmoji}>{l.flag}</Text>
                    <Text
                      style={[
                        styles.segmentLabel,
                        { color: active ? theme.accent : palette.textSecondary },
                        active && styles.segmentLabelActive,
                      ]}
                    >
                      {l.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Appearance */}
            <Text style={[styles.sectionLabel, { color: palette.textFaint }]}>
              {t('Theme')}
            </Text>
            <View style={styles.segmentRow}>
              {modes.map((m) => {
                const active = mode === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMode(m.key)}
                    style={[
                      styles.segment,
                      { borderColor: active ? theme.primary : palette.border },
                      active && { backgroundColor: theme.light },
                    ]}
                  >
                    <Ionicons
                      name={m.icon as keyof typeof Ionicons.glyphMap}
                      size={22}
                      color={active ? theme.accent : palette.textFaint}
                    />
                    <Text
                      style={[
                        styles.segmentLabel,
                        { color: active ? theme.accent : palette.textSecondary },
                        active && styles.segmentLabelActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {followsSystem && (
              <Text style={[styles.hint, { color: palette.textFaint }]}>
                {t('System default')}
              </Text>
            )}
            <Text style={[styles.hint, { color: palette.textFaint }]}>
              {t('Saved per account')}
            </Text>
          </RoundedCard>
        </Pressable>
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
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  headerEmoji: { fontSize: 30 },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  closeButton: { padding: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  segmentRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: RADIUS.pill,
    paddingVertical: 12,
  },
  segmentEmoji: { fontSize: 18 },
  segmentLabel: { fontSize: 14, fontWeight: '600' },
  segmentLabelActive: { fontWeight: '800' },
  hint: { fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: -6, marginBottom: 4 },
});
