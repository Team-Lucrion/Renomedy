import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography } from '../theme/theme';

type ErrorBannerProps = {
  message: string;
  type?: 'error' | 'warning' | 'info';
};

export default function ErrorBanner({ message, type = 'error' }: ErrorBannerProps) {
  if (!message) return null;

  const config = {
    error: {
      icon: 'alert-circle' as const,
      color: colors.danger,
      backgroundColor: colors.errorBackground,
      borderColor: colors.errorBorder,
    },
    warning: {
      icon: 'warning' as const,
      color: colors.warning,
      backgroundColor: colors.warningBackground,
      borderColor: colors.warningBorder,
    },
    info: {
      icon: 'information-circle' as const,
      color: colors.primary,
      backgroundColor: colors.infoBackground,
      borderColor: colors.infoBorder,
    },
  };

  const currentConfig = config[type];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: currentConfig.backgroundColor,
          borderColor: currentConfig.borderColor,
        }
      ]}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={`${type} message: ${message}`}
    >
      <Ionicons name={currentConfig.icon} size={20} color={currentConfig.color} style={styles.icon} />
      <Text style={[styles.text, { color: currentConfig.color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginVertical: spacing.sm,
  },
  icon: {
    marginRight: spacing.sm,
  },
  text: {
    ...typography.bodySmall,
    flex: 1,
  },
});
