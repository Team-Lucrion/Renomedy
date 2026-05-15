import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onViewPlans?: () => void;
};

export default function UpgradeModal({ visible, title, message, onClose, onViewPlans }: Props) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onViewPlans ?? onClose}>
            <Text style={styles.primaryButtonText}>View Renomedy Plans</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(28, 43, 49, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    maxWidth: 420,
    padding: spacing.xl,
    width: '100%',
    ...shadows.md,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: `${colors.secondary}28`,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 56,
  },
  title: {
    ...typography.h2,
    color: colors.primary,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 23,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 52,
    width: '100%',
  },
  primaryButtonText: {
    ...typography.label,
    color: colors.surface,
  },
  secondaryButton: {
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.label,
    color: colors.primary,
  },
});
