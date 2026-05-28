import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

type Props = {
  visible: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function RenoItModal({ visible, loading = false, onConfirm, onCancel }: Props) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="paper-plane-outline" size={24} color={colors.primary} />
          </View>
          <Text style={styles.title}>What is Reno It?</Text>
          <Text style={styles.message}>
            Reno It creates a clean, family-friendly prescription card you can share on WhatsApp so everyone understands the medicines clearly.
          </Text>
          <TouchableOpacity
            disabled={loading}
            style={[styles.confirmButton, loading ? styles.disabled : null]}
            onPress={onConfirm}
          >
            <Text style={styles.confirmText}>{loading ? 'Opening WhatsApp...' : 'Share with WhatsApp'}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={loading} style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 39, 45, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    maxWidth: 420,
    padding: spacing.xl,
    width: '100%',
    ...shadows.md,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: `${colors.secondary}30`,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 48,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 52,
  },
  confirmText: {
    ...typography.label,
    color: colors.surface,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 48,
  },
  cancelText: {
    ...typography.label,
    color: colors.primary,
  },
  disabled: {
    opacity: 0.72,
  },
});
