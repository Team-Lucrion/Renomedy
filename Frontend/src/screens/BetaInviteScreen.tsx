import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppData } from '../context/AppDataContext';
import { trackEvent } from '../lib/analytics';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

function getBetaInviteErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message.toLowerCase() : '';

  if (rawMessage.includes('already used')) {
    return 'That beta code has already been used.';
  }

  if (rawMessage.includes('expired')) {
    return 'That beta code has expired. Please ask for a new code.';
  }

  if (rawMessage.includes('inactive') || rawMessage.includes('not active') || rawMessage.includes('revoked')) {
    return 'That beta code is not active. Please ask for a new code.';
  }

  if (rawMessage.includes('already approved')) {
    return 'This account already has beta access.';
  }

  if (rawMessage.includes('invalid') || rawMessage.includes('not found')) {
    return 'That beta code does not look valid. Please check it and try again.';
  }

  return 'We could not check that beta code. Please try again.';
}

export default function BetaInviteScreen() {
  const { activateBetaAccess } = useAppData();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUnlock = async () => {
    const normalizedCode = inviteCode.trim().toUpperCase();
    if (!normalizedCode) {
      setError('Enter your beta invite code.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await activateBetaAccess(normalizedCode);
      setInviteCode('');
    } catch (unlockError) {
      trackEvent('beta_code_invalid', {
        reason: unlockError instanceof Error ? unlockError.message : 'unknown_error',
      });
      setError(getBetaInviteErrorMessage(unlockError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <View style={styles.iconWrap}>
            <Ionicons name="key-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>Enter Beta Invite Code</Text>
          <Text style={styles.subtitle}>
            Renomedy is invite-only while we test with early families. Enter the beta code shared with you.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Beta code</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isSubmitting}
            onChangeText={(value) => setInviteCode(value.toUpperCase())}
            placeholder="RENO-BETA-XXXX"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={inviteCode}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            disabled={isSubmitting}
            onPress={() => void handleUnlock()}
            style={[styles.primaryButton, isSubmitting ? styles.disabledButton : null]}
          >
            <Text style={styles.primaryButtonText}>
              {isSubmitting ? 'Checking code...' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.md,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: `${colors.secondary}28`,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: 56,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 23,
    marginTop: spacing.sm,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.text,
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 52,
  },
  primaryButtonText: {
    ...typography.label,
    color: colors.surface,
  },
  disabledButton: {
    opacity: 0.72,
  },
});
