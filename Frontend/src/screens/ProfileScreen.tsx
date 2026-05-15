import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useClerk, useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import ConfirmActionModal from '../components/ConfirmActionModal';
import { useAppData } from '../context/AppDataContext';
import { unregisterStoredNotifications } from '../lib/notifications';
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
  const navigation = useNavigation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { currentUser, familyGroups, familyMembers, refreshAll, error, betaBlocked, leaveSanctuary, unregisterNotificationToken, sendTestPush } = useAppData();
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const displayName =
    currentUser?.full_name ??
    user?.fullName ??
    'Renomedy Caregiver';

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    'No email available';

  const currentSanctuary = familyGroups[0] ?? null;

  const handleSignOut = async () => {
    await unregisterStoredNotifications(unregisterNotificationToken);
    await signOut();
  };

  const handleLeaveSanctuary = async () => {
    setIsLeaving(true);
    try {
      await leaveSanctuary();
      setShowLeaveConfirm(false);
      setActionMessage('You have left the sanctuary.');
    } catch (leaveError) {
      setActionMessage(leaveError instanceof Error ? leaveError.message : 'Unable to leave sanctuary.');
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={24} color={colors.primary} />
        </TouchableOpacity>
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
          <Text style={styles.sectionTitle}>Sanctuary Status</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Current sanctuary</Text>
            <Text style={styles.detailValue}>{currentSanctuary?.family_name ?? 'Not joined'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Beta access</Text>
            <Text style={styles.detailValue}>{formatBetaStatus(currentUser?.beta_access_status)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Onboarding</Text>
            <Text style={styles.detailValue}>{currentUser?.onboarding_complete ? 'Complete' : 'Pending'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Sanctuaries</Text>
            <Text style={styles.detailValue}>{familyGroups.length}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Sanctuary members</Text>
            <Text style={styles.detailValue}>{familyMembers.length}</Text>
          </View>
          {betaBlocked ? (
            <Text style={styles.noticeText}>
              This account is authenticated, but sanctuary and medication data is blocked until beta access is approved.
            </Text>
          ) : null}
          {actionMessage ? <Text style={styles.noticeText}>{actionMessage}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => void refreshAll()}>
          <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Refresh Backend Data</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => void sendTestPush()}>
          <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Send Test Push</Text>
        </TouchableOpacity>

        {currentSanctuary ? (
          <TouchableOpacity style={styles.leaveButton} onPress={() => setShowLeaveConfirm(true)}>
            <Text style={styles.leaveText}>Leave Sanctuary</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.logoutButton} onPress={() => void handleSignOut()}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmActionModal
        visible={showLeaveConfirm}
        title="Leave sanctuary?"
        message="You will lose access to shared prescriptions, reminders, and family coordination until you join again."
        confirmLabel="Leave sanctuary"
        destructive
        loading={isLeaving}
        onConfirm={() => void handleLeaveSanctuary()}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
  leaveButton: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  leaveText: {
    ...typography.label,
    color: colors.warning,
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
