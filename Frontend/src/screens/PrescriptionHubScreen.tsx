import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppData } from '../context/AppDataContext';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

function formatPrescriptionDate(value?: string | null) {
  if (!value) {
    return 'Date unavailable';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}

function formatStatus(value?: string | null) {
  if (!value) {
    return 'Pending';
  }

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function PrescriptionHubScreen() {
  const { prescriptions, isLoading, error, refreshAll } = useAppData();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Prescription Hub</Text>
        <TouchableOpacity onPress={() => void refreshAll()}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.uploadCard}>
          <View style={styles.uploadIconContainer}>
            <Ionicons name="document-text-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.uploadTitle}>Prescription uploads are backend-ready</Text>
          <Text style={styles.uploadSubtitle}>
            History below is now loaded from the API. Camera/file upload UI is the remaining piece to add on top of the existing backend route.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>History</Text>

        {prescriptions.length > 0 ? (
          prescriptions.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View style={styles.historyInfo}>
                <Text style={styles.historyTitle}>
                  {item.doctor_name || item.hospital_name || 'Prescription Record'}
                </Text>
                <Text style={styles.historyDate}>
                  {formatPrescriptionDate(item.prescription_date)}
                  {item.family_members?.full_name ? ` • For ${item.family_members.full_name}` : ''}
                </Text>
                <Text style={styles.historyMeta}>
                  Verification: {formatStatus(item.verification_status)} • Parse: {formatStatus(item.parse_status)}
                </Text>
                <Text style={styles.historyMeta}>
                  Medications: {item.prescription_medications?.length ?? 0}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{formatStatus(item.parse_status)}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {isLoading ? 'Loading prescriptions...' : 'No prescription history is available yet.'}
            </Text>
          </View>
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
  },
  scrollContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.lg,
  },
  uploadCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  uploadIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.secondary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  uploadTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  uploadSubtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  errorCard: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FED7D7',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
    flex: 1,
  },
  sectionTitle: {
    ...typography.h3,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.sm,
    gap: spacing.md,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    ...typography.label,
    fontSize: 16,
  },
  historyDate: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  historyMeta: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
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
});
