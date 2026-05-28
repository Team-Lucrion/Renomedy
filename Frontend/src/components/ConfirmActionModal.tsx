import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmActionModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  loading = false,
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const accentColor = destructive ? colors.danger : colors.primary;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: `${accentColor}15` }]}>
            <Ionicons
              name={destructive ? 'trash-outline' : 'alert-circle-outline'}
              size={24}
              color={accentColor}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity
            disabled={loading}
            style={[styles.confirmButton, { backgroundColor: accentColor }, loading ? styles.disabled : null]}
            onPress={onConfirm}
          >
            <Text style={styles.confirmText}>{loading ? 'Please wait...' : confirmLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={loading} style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 39, 45, 0.38)',
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
