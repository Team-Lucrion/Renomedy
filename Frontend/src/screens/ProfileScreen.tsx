import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useClerk, useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { useAppData } from '../context/AppDataContext';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

function formatBetaStatus(status?: string | null) {
  if (!status) {
    return 'Pending';
  }

  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ProfileScreen() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const { currentUser, familyGroups, familyMembers, refreshAll, error, betaBlocked } = useAppData();

  const displayName =
    currentUser?.full_name ??
    user?.fullName ??
    'Swasthi Caregiver';

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    'No email available';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName[0]?.toUpperCase() ?? 'S'}</Text>
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Backend Status</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Beta access</Text>
            <Text style={styles.detailValue}>{formatBetaStatus(currentUser?.beta_access_status)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Onboarding</Text>
            <Text style={styles.detailValue}>{currentUser?.onboarding_complete ? 'Complete' : 'Pending'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Family groups</Text>
            <Text style={styles.detailValue}>{familyGroups.length}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Family members</Text>
            <Text style={styles.detailValue}>{familyMembers.length}</Text>
          </View>
          {betaBlocked ? (
            <Text style={styles.noticeText}>
              This account is authenticated, but backend family and medication data is blocked until beta access is approved.
            </Text>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => void refreshAll()}>
          <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Refresh Backend Data</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={() => void signOut()}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  headerTitle: {
    ...typography.h2,
  },
  scrollContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.lg,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    ...shadows.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    ...typography.h2,
    color: colors.surface,
  },
  profileName: {
    ...typography.h3,
  },
  profileEmail: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.sm,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  detailValue: {
    ...typography.label,
  },
  noticeText: {
    ...typography.bodySmall,
    color: colors.warning,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.pill,
    padding: spacing.md,
    gap: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  logoutButton: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  logoutText: {
    ...typography.label,
    color: colors.danger,
  },
});
