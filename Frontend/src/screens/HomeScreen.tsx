import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { familyMembers, medications } from '../data/mockData';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  
  const todayMeds = medications.filter(m => m.status === 'pending');
  const refillAlerts = medications.filter(m => m.refillRisk === 'Risk Soon' || m.refillRisk === 'Will Run Out');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good Morning, Arjun</Text>
          <Text style={styles.subtitle}>Family Health Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.profileButton}>
          <Ionicons name="person-circle" size={40} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Family Summary Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Family Overview</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AddFamilyMember')}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.familyList}>
            {familyMembers.map((member) => (
              <View key={member.id} style={styles.familyMemberBadge}>
                <Ionicons name="person" size={16} color={colors.surface} />
                <Text style={styles.familyMemberName}>{member.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionGrid}>
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: colors.primary }]}
            // Navigate to Prescription tab via bottom nav? Wait, this is stack nav.
            // For now, we just rely on bottom tabs for prescription. Let's not navigate here to prevent TS errors.
          >
            <Ionicons name="scan" size={28} color={colors.surface} />
            <Text style={styles.actionCardText}>Scan & Understand Prescription</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.secondary }]}>
            <Ionicons name="add" size={28} color={colors.surface} />
            <Text style={[styles.actionCardText, { color: colors.text }]}>Add Medicine Manually</Text>
          </TouchableOpacity>
        </View>

        {/* Refill Alerts */}
        {refillAlerts.length > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Ionicons name="warning" size={20} color={colors.warning} />
              <Text style={styles.alertTitle}>Refill Continuity Alert</Text>
            </View>
            {refillAlerts.map(med => (
              <View key={med.id} style={styles.alertItem}>
                <Text style={styles.alertMedName}>{med.name} ({familyMembers.find(f => f.id === med.memberId)?.name})</Text>
                <Text style={styles.alertMedRisk}>{med.refillRisk}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Today's Medications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Pending</Text>
          {todayMeds.map((med) => (
            <View key={med.id} style={styles.medCard}>
              <View style={styles.medInfo}>
                <Text style={styles.medName}>{med.name} {med.strength}</Text>
                <Text style={styles.medTime}>{med.time} • For {familyMembers.find(f => f.id === med.memberId)?.name}</Text>
              </View>
              <TouchableOpacity style={styles.medButton}>
                <Ionicons name="checkmark-circle-outline" size={28} color={colors.success} />
              </TouchableOpacity>
            </View>
          ))}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    ...shadows.sm,
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
  familyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    ...shadows.sm,
    gap: spacing.sm,
  },
  actionCardText: {
    ...typography.label,
    color: colors.surface,
    fontSize: 16,
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
});
