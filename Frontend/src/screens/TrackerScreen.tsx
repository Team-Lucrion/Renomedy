import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppData } from '../context/AppDataContext';
import { findFirst } from '../lib/collections';
import { hasNotificationPromptBeenSeen, openNotificationSettings, setupMedicationNotifications } from '../lib/notifications';
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
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'schedule' | 'refills'>('schedule');
  const { familyMembers, schedules, refillStates, logDose, isLoading, registerNotificationToken } = useAppData();
  const [notificationState, setNotificationState] = useState<'idle' | 'registered' | 'denied' | 'unsupported' | 'error'>('idle');
  const [notificationMessage, setNotificationMessage] = useState('');

  const scheduleCards = useMemo(
    () =>
      schedules.map((schedule) => {
        const member = findFirst(familyMembers, (item) => item.id === schedule.family_member_id);
        const refillState = findFirst(refillStates, (item) => item.medication_schedule_id === schedule.id);

        return {
          id: schedule.id,
          memberName: member?.full_name ?? t('tracker.familyMemberFallback'),
          medicationName:
            schedule.prescription_medications?.medicine_name ??
            schedule.prescription_medications?.brand_name ??
            schedule.prescription_medications?.generic_name ??
            t('tracker.medicationFallback'),
          dosage: schedule.prescription_medications?.dosage ?? '',
          reminderTimes: schedule.reminder_times?.join(', ') ?? t('tracker.noReminderTimes'),
          scheduleStatus: schedule.status ?? 'active',
          refillStatus: refillState?.continuity_status ?? null,
        };
      }),
    [familyMembers, refillStates, schedules, t],
  );

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (schedules.length === 0) {
        return;
      }

      const promptSeen = await hasNotificationPromptBeenSeen();
      if (promptSeen && notificationState !== 'idle') {
        return;
      }

      const result = await setupMedicationNotifications(registerNotificationToken);
      if (!active) {
        return;
      }

      setNotificationState(result.status);
      if (result.status === 'denied') {
        setNotificationMessage(t('tracker.notificationsDenied'));
      } else if (result.status === 'unsupported' || result.status === 'error') {
        setNotificationMessage(result.reason);
      } else {
        setNotificationMessage(t('tracker.notificationsActive'));
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [notificationState, registerNotificationToken, schedules.length, t]);

  const renderSchedule = () => {
    if (scheduleCards.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {isLoading ? t('tracker.loadingSchedules') : t('tracker.noSchedules')}
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
                  {t('tracker.scheduleStatusLine', {
                    status: med.scheduleStatus,
                    refill: med.refillStatus ? t('tracker.refillSuffix', { status: formatContinuityStatus(med.refillStatus) }) : '',
                  })}
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
            {isLoading ? t('tracker.loadingRefills') : t('tracker.noRefills')}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {refillStates.map((refill) => {
          const schedule = findFirst(schedules, (item) => item.id === refill.medication_schedule_id);
          const member = findFirst(familyMembers, (item) => item.id === schedule?.family_member_id);
          const riskColor = statusTone(refill.continuity_status);

          return (
            <View key={refill.medication_schedule_id} style={styles.refillCard}>
              <View style={styles.refillInfo}>
                <Text style={styles.medName}>
                  {schedule?.prescription_medications?.medicine_name ??
                    schedule?.prescription_medications?.brand_name ??
                    t('tracker.medicationFallback')}
                </Text>
                <Text style={styles.medInstructions}>
                  {t('tracker.forMember', { name: member?.full_name ?? t('tracker.familyMemberFallback') })}
                </Text>
              </View>
              <View style={styles.refillStatus}>
                <Text style={styles.dosesText}>
                  {t('tracker.dosesLeft', { count: refill.quantity_remaining ?? '-' })}
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
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
            <Ionicons name="menu" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('tracker.title')}</Text>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'schedule' && styles.activeTab]}
            onPress={() => setActiveTab('schedule')}
          >
            <Text style={[styles.tabText, activeTab === 'schedule' && styles.activeTabText]}>{t('tracker.scheduleTab')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'refills' && styles.activeTab]}
            onPress={() => setActiveTab('refills')}
          >
            <Text style={[styles.tabText, activeTab === 'refills' && styles.activeTabText]}>{t('tracker.refillsTab')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {schedules.length > 0 && notificationMessage ? (
          <View style={[styles.notificationCard, notificationState === 'registered' ? styles.notificationCardSuccess : styles.notificationCardWarning]}>
            <Ionicons
              name={notificationState === 'registered' ? 'notifications-outline' : 'alert-circle-outline'}
              size={18}
              color={notificationState === 'registered' ? colors.success : colors.warning}
            />
            <Text style={styles.notificationText}>{notificationMessage}</Text>
            {notificationState === 'denied' ? (
              <TouchableOpacity onPress={() => void openNotificationSettings()}>
                <Text style={styles.notificationLink}>{t('tracker.openSettings')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
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
    paddingTop: 52,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
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
  notificationCard: {
    alignItems: 'center',
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  notificationCardSuccess: {
    backgroundColor: '#F0FFF4',
  },
  notificationCardWarning: {
    backgroundColor: '#FFFAF0',
  },
  notificationText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  notificationLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
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
