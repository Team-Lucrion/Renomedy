import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ConfirmActionModal from '../components/ConfirmActionModal';
import MemberAvatar from '../components/MemberAvatar';
import { useAppData } from '../context/AppDataContext';
import { findFirst } from '../lib/collections';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyMemberDetails'>;

function labelizeRole(role?: string | null) {
  if (role === 'caregiver') return 'Caregiver';
  if (role === 'patient') return 'Patient';
  return 'Family Member';
}

export default function FamilyMemberDetailsScreen({ navigation, route }: Props) {
  const { familyMembers, familyGroups, archiveFamilyMember } = useAppData();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const member = findFirst(familyMembers, (item) => item.id === route.params.memberId);
  const currentMembership = familyGroups[0]?.family_group_memberships?.[0];
  const canManage = currentMembership?.role === 'owner' || currentMembership?.role === 'caregiver';

  const stats = useMemo(
    () => [
      { label: 'Active meds', value: String(member?.active_medication_count ?? 0) },
      { label: 'Reminders', value: String(member?.active_reminder_count ?? 0) },
      { label: 'Prescriptions', value: String(member?.prescription_count ?? 0) },
    ],
    [member],
  );

  if (!member) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="person-circle-outline" size={48} color={colors.primary} />
        <Text style={styles.emptyTitle}>Sanctuary member not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await archiveFamilyMember(member.id);
      setConfirmVisible(false);
      navigation.goBack();
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.topButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <MemberAvatar avatarUrl={member.avatar_url} name={member.name ?? member.full_name} size={88} />
          <Text style={styles.name}>{member.name ?? member.full_name}</Text>
          <Text style={styles.subtitle}>{member.relationship}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{labelizeRole(member.role)}</Text>
          </View>
          <Text style={styles.statusText}>{member.medication_status ?? 'Profile ready'}</Text>
        </View>

        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Age</Text>
            <Text style={styles.detailValue}>{member.age ?? 'Not added'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Gender</Text>
            <Text style={styles.detailValue}>{member.gender ?? 'Not added'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Role</Text>
            <Text style={styles.detailValue}>{labelizeRole(member.role)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Relationship</Text>
            <Text style={styles.detailValue}>{member.relationship}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Medication profile</Text>
          {member.chronic_conditions?.length ? (
            <View style={styles.chips}>
              {member.chronic_conditions.map((condition: string) => (
                <View key={condition} style={styles.chip}>
                  <Text style={styles.chipText}>{condition}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.helperText}>No conditions added yet.</Text>
          )}
          <Text style={[styles.sectionTitle, styles.notesTitle]}>Care notes</Text>
          <Text style={styles.notesText}>{member.notes ?? 'No notes added yet.'}</Text>
        </View>

        {canManage ? (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('AddFamilyMember', { memberId: member.id })}>
              <Ionicons name="create-outline" size={18} color={colors.surface} />
              <Text style={styles.primaryButtonText}>Edit Member</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setConfirmVisible(true)}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.secondaryButtonText}>Remove Member</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <ConfirmActionModal
        visible={confirmVisible}
        title="Remove sanctuary member?"
        message="This will remove the sanctuary member and related medication access."
        confirmLabel="Remove sanctuary member"
        loading={isArchiving}
        destructive
        onConfirm={() => void handleArchive()}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 100,
    paddingTop: 52,
  },
  topButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
    ...shadows.sm,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.sm,
  },
  name: {
    ...typography.h2,
    color: colors.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: `${colors.secondary}28`,
    borderRadius: borderRadius.pill,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  roleBadgeText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  statusText: {
    ...typography.bodySmall,
    marginTop: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    flex: 1,
    padding: spacing.md,
    ...shadows.sm,
  },
  statValue: {
    ...typography.h3,
    color: colors.primary,
  },
  statLabel: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  detailLabel: {
    ...typography.bodySmall,
  },
  detailValue: {
    ...typography.label,
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: `${colors.secondary}22`,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  helperText: {
    ...typography.bodySmall,
  },
  notesTitle: {
    marginTop: spacing.lg,
  },
  notesText: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.sm,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    ...typography.label,
    color: colors.surface,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: `${colors.danger}35`,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryButtonText: {
    ...typography.label,
    color: colors.danger,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.md,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  backButtonText: {
    ...typography.label,
    color: colors.surface,
  },
});
