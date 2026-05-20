import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';
import { useTranslation } from 'react-i18next';
import { useAppData } from '../context/AppDataContext';
import { findFirst } from '../lib/collections';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

function formatContinuityStatus(status?: string | null) {
  if (!status) {
    return 'Unknown';
  }

  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useUser();
  const { currentUser, familyGroups, familyMembers, overview, schedules, refillStates, error, refreshAll } = useAppData();

  const greetingName =
    currentUser?.full_name?.split(' ')[0] ??
    user?.firstName ??
    user?.fullName?.split(' ')[0] ??
    'Caregiver';

  const refillAlerts = refillStates.filter((state) => {
    const status = state.continuity_status ?? '';
    return status === 'risk_soon' || status === 'will_run_out' || status === 'out_of_stock';
  });
  const currentMembership = familyGroups[0]?.family_group_memberships?.[0];
  const canManageFamily = currentMembership?.role === 'owner' || currentMembership?.role === 'caregiver';

  const activeSchedules = schedules.slice(0, 4);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.greeting}>{t('home.greeting', { name: greetingName })}</Text>
          <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
        </View>
        <TouchableOpacity style={styles.profileButton} onPress={() => void refreshAll()}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.backendMessageCard}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.backendMessageText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{overview?.family_members_count ?? familyMembers.length}</Text>
            <Text style={styles.statLabel}>{t('home.sanctuaryMembers')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{overview?.active_schedules_count ?? schedules.length}</Text>
            <Text style={styles.statLabel}>{t('home.activeSchedules')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{overview?.missed_doses_last_24h ?? 0}</Text>
            <Text style={styles.statLabel}>{t('home.missed24h')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{overview?.refill_risk_count ?? refillAlerts.length}</Text>
            <Text style={styles.statLabel}>{t('home.refillRisks')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('home.overview')}</Text>
            {canManageFamily ? (
              <TouchableOpacity onPress={() => navigation.navigate('AddFamilyMember')}>
                <Ionicons name="add-circle" size={24} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {familyGroups.length > 0 ? (
            <>
              <Text style={styles.familyName}>{familyGroups[0].family_name}</Text>
              {familyGroups[0].invite_code ? (
                <Text style={styles.inviteCode}>{t('home.inviteCode', { code: familyGroups[0].invite_code })}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.emptyStateText}>{t('home.noSanctuary')}</Text>
          )}

          <View style={styles.familyList}>
            {familyMembers.map((member) => (
              <View key={member.id} style={styles.familyMemberBadge}>
                <Ionicons name="person" size={16} color={colors.surface} />
                <Text style={styles.familyMemberName}>{member.name ?? member.full_name}</Text>
              </View>
            ))}
          </View>
        </View>

        {refillAlerts.length > 0 ? (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Ionicons name="warning" size={20} color={colors.warning} />
              <Text style={styles.alertTitle}>{t('home.refillAlert')}</Text>
            </View>
            {refillAlerts.map((alert) => {
              const schedule = findFirst(schedules, (item) => item.id === alert.medication_schedule_id);
              const member = findFirst(familyMembers, (item) => item.id === schedule?.family_member_id);

              return (
                <View key={alert.medication_schedule_id} style={styles.alertItem}>
                  <Text style={styles.alertMedName}>{member?.name ?? member?.full_name ?? t('home.familyMemberFallback')}</Text>
                  <Text style={styles.alertMedRisk}>{formatContinuityStatus(alert.continuity_status)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.activeMedicationSchedules')}</Text>
          {activeSchedules.length > 0 ? (
            activeSchedules.map((schedule) => {
              const member = findFirst(familyMembers, (item) => item.id === schedule.family_member_id);
              const medicationName =
                schedule.prescription_medications?.medicine_name ??
                schedule.prescription_medications?.brand_name ??
                schedule.prescription_medications?.generic_name ??
                'Medication';

              return (
                <View key={schedule.id} style={styles.medCard}>
                  <View style={styles.medInfo}>
                    <Text style={styles.medName}>
                      {medicationName}
                      {schedule.prescription_medications?.dosage ? ` ${schedule.prescription_medications.dosage}` : ''}
                    </Text>
                    <Text style={styles.medTime}>
                      {(schedule.reminder_times?.length ? schedule.reminder_times.join(', ') : t('home.noReminderTimes'))}
                      {' | '}
                      {t('home.forMember', { name: member?.name ?? member?.full_name ?? t('home.familyMemberFallback') })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.medButton}
                    onPress={() => navigation.dispatch(DrawerActions.jumpTo('Medications'))}
                  >
                    <Ionicons name="chevron-forward-circle-outline" size={28} color={colors.success} />
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyStateText}>{t('home.noSchedules')}</Text>
            </View>
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.md,
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
  headerCopy: {
    flex: 1,
  },
  greeting: {
    ...typography.h2,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  profileButton: {
    padding: spacing.xs,
  },
  scrollContainer: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 100,
  },
  backendMessageCard: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FED7D7',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  backendMessageText: {
    ...typography.bodySmall,
    color: colors.danger,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  statValue: {
    ...typography.h2,
    color: colors.primary,
  },
  statLabel: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h3,
  },
  familyName: {
    ...typography.label,
    fontSize: 16,
  },
  inviteCode: {
    ...typography.bodySmall,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  familyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  familyMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    gap: spacing.xs,
  },
  familyMemberName: {
    ...typography.label,
    color: colors.surface,
  },
  alertCard: {
    backgroundColor: '#FFFAF0',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#FBD38D',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  alertTitle: {
    ...typography.label,
    color: colors.warning,
    fontSize: 16,
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  alertMedName: {
    ...typography.body,
  },
  alertMedRisk: {
    ...typography.label,
    color: colors.danger,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  medCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    ...typography.label,
    fontSize: 16,
  },
  medTime: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  medButton: {
    padding: spacing.xs,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.sm,
  },
  emptyStateText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
});
