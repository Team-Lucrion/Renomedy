import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { medications, familyMembers } from '../data/mockData';

export default function TrackerScreen() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'refills'>('schedule');

  const renderSchedule = () => {
    return (
      <View style={styles.tabContent}>
        <View style={styles.caregiverAlert}>
          <Ionicons name="notifications" size={20} color={colors.surface} />
          <Text style={styles.caregiverAlertText}>Dad missed his Amlodipine dose at 09:00 AM.</Text>
          <TouchableOpacity>
            <Text style={styles.caregiverAlertAction}>Call Now</Text>
          </TouchableOpacity>
        </View>

        {medications.map((med) => {
          const member = familyMembers.find(f => f.id === med.memberId);
          return (
            <View key={med.id} style={styles.medCard}>
              <View style={styles.medHeader}>
                <Text style={styles.medTime}>{med.time}</Text>
                <View style={styles.memberBadge}>
                  <Text style={styles.memberBadgeText}>{member?.name}</Text>
                </View>
              </View>
              
              <View style={styles.medBody}>
                <View style={styles.medInfo}>
                  <Text style={styles.medName}>{med.name} {med.strength}</Text>
                  <Text style={styles.medInstructions}>{med.schedule}</Text>
                </View>
                
                <View style={styles.actions}>
                  {med.status === 'taken' && (
                    <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
                      <Ionicons name="checkmark" size={16} color={colors.success} />
                      <Text style={[styles.statusText, { color: colors.success }]}>Taken</Text>
                    </View>
                  )}
                  {med.status === 'missed' && (
                    <View style={[styles.statusBadge, { backgroundColor: colors.danger + '20' }]}>
                      <Ionicons name="close" size={16} color={colors.danger} />
                      <Text style={[styles.statusText, { color: colors.danger }]}>Missed</Text>
                    </View>
                  )}
                  {med.status === 'pending' && (
                    <>
                      <TouchableOpacity style={styles.actionButton}>
                        <Ionicons name="alarm-outline" size={24} color={colors.warning} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionButton, styles.primaryAction]}>
                        <Ionicons name="checkmark" size={24} color={colors.surface} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderRefills = () => {
    return (
      <View style={styles.tabContent}>
        {medications.map(med => {
          const member = familyMembers.find(f => f.id === med.memberId);
          let riskColor = colors.success;
          if (med.refillRisk === 'Risk Soon') riskColor = colors.warning;
          if (med.refillRisk === 'Will Run Out' || med.refillRisk === 'Out of Stock') riskColor = colors.danger;

          return (
            <View key={med.id} style={styles.refillCard}>
              <View style={styles.refillInfo}>
                <Text style={styles.medName}>{med.name}</Text>
                <Text style={styles.medInstructions}>For {member?.name}</Text>
              </View>
              <View style={styles.refillStatus}>
                <Text style={styles.dosesText}>{med.remainingDoses} doses left</Text>
                <View style={[styles.riskBadge, { borderColor: riskColor, backgroundColor: riskColor + '10' }]}>
                  <Text style={[styles.riskText, { color: riskColor }]}>{med.refillRisk}</Text>
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
  caregiverAlert: {
    flexDirection: 'row',
    backgroundColor: colors.danger,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  caregiverAlertText: {
    ...typography.bodySmall,
    color: colors.surface,
    flex: 1,
    marginHorizontal: spacing.sm,
    fontWeight: '600',
  },
  caregiverAlertAction: {
    ...typography.label,
    color: colors.surface,
    textDecorationLine: 'underline',
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    gap: 4,
  },
  statusText: {
    ...typography.label,
    fontSize: 12,
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
