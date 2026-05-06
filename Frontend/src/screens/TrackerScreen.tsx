import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppData } from '../context/AppDataContext';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';

function formatContinuityStatus(status?: string | null) {
  if (!status) {
    return 'Unknown';
  }

  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusTone(status?: string | null) {
  if (status === 'risk_soon') {
    return colors.warning;
  }

  if (status === 'will_run_out' || status === 'out_of_stock') {
    return colors.danger;
  }

  return colors.success;
}

export default function TrackerScreen() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'refills'>('schedule');
  const { familyMembers, schedules, refillStates, logDose, isLoading } = useAppData();

  const scheduleCards = useMemo(
    () =>
      schedules.map((schedule) => {
        const member = familyMembers.find((item) => item.id === schedule.family_member_id);
        const refillState = refillStates.find((item) => item.medication_schedule_id === schedule.id);

        return {
          id: schedule.id,
          memberName: member?.full_name ?? 'Family member',
          medicationName:
            schedule.prescription_medications?.medicine_name ??
            schedule.prescription_medications?.brand_name ??
            schedule.prescription_medications?.generic_name ??
            'Medication',
          dosage: schedule.prescription_medications?.dosage ?? '',
          reminderTimes: schedule.reminder_times?.join(', ') ?? 'No reminder times',
          scheduleStatus: schedule.status ?? 'active',
          refillStatus: refillState?.continuity_status ?? null,
        };
      }),
    [familyMembers, refillStates, schedules],
  );

  const renderSchedule = () => {
    if (scheduleCards.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {isLoading ? 'Loading schedules...' : 'No medication schedules are active yet.'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {scheduleCards.map((med) => (
          <View key={med.id} style={styles.medCard}>
            <View style={styles.medHeader}>
              <Text style={styles.medTime}>{med.reminderTimes}</Text>
              <View style={styles.memberBadge}>
                <Text style={styles.memberBadgeText}>{med.memberName}</Text>
              </View>
            </View>

            <View style={styles.medBody}>
              <View style={styles.medInfo}>
                <Text style={styles.medName}>
                  {med.medicationName}
                  {med.dosage ? ` ${med.dosage}` : ''}
                </Text>
                <Text style={styles.medInstructions}>
                  Status: {med.scheduleStatus}
                  {med.refillStatus ? ` • Refill ${formatContinuityStatus(med.refillStatus)}` : ''}
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => void logDose({ medication_schedule_id: med.id, status: 'missed' })}
                >
                  <Ionicons name="close-outline" size={24} color={colors.warning} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryAction]}
                  onPress={() => void logDose({ medication_schedule_id: med.id, status: 'taken' })}
                >
                  <Ionicons name="checkmark" size={24} color={colors.surface} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderRefills = () => {
    if (refillStates.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {isLoading ? 'Loading refill continuity...' : 'No refill tracking has been initialized yet.'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {refillStates.map((refill) => {
          const schedule = schedules.find((item) => item.id === refill.medication_schedule_id);
          const member = familyMembers.find((item) => item.id === schedule?.family_member_id);
          const riskColor = statusTone(refill.continuity_status);

          return (
            <View key={refill.medication_schedule_id} style={styles.refillCard}>
              <View style={styles.refillInfo}>
                <Text style={styles.medName}>
                  {schedule?.prescription_medications?.medicine_name ??
                    schedule?.prescription_medications?.brand_name ??
                    'Medication'}
                </Text>
                <Text style={styles.medInstructions}>For {member?.full_name ?? 'Family member'}</Text>
              </View>
              <View style={styles.refillStatus}>
                <Text style={styles.dosesText}>
                  {refill.quantity_remaining ?? '-'} doses left
                </Text>
                <View
                  style={[
                    styles.riskBadge,
                    { borderColor: riskColor, backgroundColor: `${riskColor}10` },
                  ]}
                >
                  <Text style={[styles.riskText, { color: riskColor }]}>
                    {formatContinuityStatus(refill.continuity_status)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tracker & Alerts</Text>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'schedule' && styles.activeTab]}
            onPress={() => setActiveTab('schedule')}
          >
            <Text style={[styles.tabText, activeTab === 'schedule' && styles.activeTabText]}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'refills' && styles.activeTab]}
            onPress={() => setActiveTab('refills')}
          >
            <Text style={[styles.tabText, activeTab === 'refills' && styles.activeTabText]}>Refills</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {activeTab === 'schedule' ? renderSchedule() : renderRefills()}
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
    paddingTop: 60,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  headerTitle: {
    ...typography.h2,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.label,
    color: colors.textMuted,
  },
  activeTabText: {
    color: colors.primary,
  },
  scrollContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  tabContent: {
    gap: spacing.lg,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.sm,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  medCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  medHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  medTime: {
    ...typography.label,
    color: colors.primary,
    flex: 1,
    paddingRight: spacing.md,
  },
  memberBadge: {
    backgroundColor: colors.inputBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  memberBadgeText: {
    ...typography.bodySmall,
    fontSize: 12,
  },
  medBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    ...typography.h3,
  },
  medInstructions: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.inputBackground,
  },
  primaryAction: {
    backgroundColor: colors.primary,
  },
  refillCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
    alignItems: 'center',
  },
  refillInfo: {
    flex: 1,
  },
  refillStatus: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dosesText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  riskText: {
    ...typography.bodySmall,
    fontSize: 12,
    fontWeight: '600',
  },
});
