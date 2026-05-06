import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PrescriptionHubScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<null | any>(null);

  // Dot matrix animation
  const dot1 = new Animated.Value(0);
  const dot2 = new Animated.Value(0);
  const dot3 = new Animated.Value(0);

  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.stagger(200, [
          Animated.sequence([
            Animated.timing(dot1, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(dot1, { toValue: 0, duration: 400, useNativeDriver: true })
          ]),
          Animated.sequence([
            Animated.timing(dot2, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(dot2, { toValue: 0, duration: 400, useNativeDriver: true })
          ]),
          Animated.sequence([
            Animated.timing(dot3, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(dot3, { toValue: 0, duration: 400, useNativeDriver: true })
          ])
        ])
      ).start();

      setTimeout(() => {
        setIsScanning(false);
        setScanResult({
          medication: 'Metformin',
          dosage: '500mg',
          instructions: 'Take twice daily after meals.',
          confidence: 'High'
        });
      }, 3000);
    }
  }, [isScanning]);

  const startScan = () => {
    setIsScanning(true);
    setScanResult(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Prescription Hub</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Upload Action */}
        <TouchableOpacity style={styles.uploadCard} onPress={startScan} disabled={isScanning}>
          <View style={styles.uploadIconContainer}>
            <Ionicons name="camera" size={40} color={colors.primary} />
          </View>
          <Text style={styles.uploadTitle}>Scan New Prescription</Text>
          <Text style={styles.uploadSubtitle}>Upload or take a photo of the medical prescription for AI-assisted explanation</Text>
        </TouchableOpacity>

        {isScanning && (
          <View style={styles.scanningContainer}>
            <Text style={styles.scanningText}>Analyzing Prescription...</Text>
            <View style={styles.dotsContainer}>
              <Animated.View style={[styles.dot, { opacity: dot1 }]} />
              <Animated.View style={[styles.dot, { opacity: dot2 }]} />
              <Animated.View style={[styles.dot, { opacity: dot3 }]} />
            </View>
          </View>
        )}

        {scanResult && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>AI-Assisted Explanation</Text>
              <View style={styles.confidenceBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} style={{ marginRight: 4 }} />
                <Text style={styles.confidenceText}>High Confidence</Text>
              </View>
            </View>

            <View style={styles.warningAlert}>
              <Ionicons name="alert-circle" size={20} color={colors.warning} />
              <Text style={styles.warningText}>Please verify before saving. AI explanation requires user verification.</Text>
            </View>

            <View style={styles.resultDetails}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Medication</Text>
                <Text style={styles.resultValue}>{scanResult.medication}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Dosage</Text>
                <Text style={styles.resultValue}>{scanResult.dosage}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Instructions</Text>
                <Text style={styles.resultValue}>{scanResult.instructions}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.verifyButton}>
              <Text style={styles.verifyButtonText}>Verify & Save Medication</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>History</Text>
        <View style={styles.historyCard}>
          <Ionicons name="document-text" size={24} color={colors.textMuted} />
          <View style={styles.historyInfo}>
            <Text style={styles.historyTitle}>Dr. Sharma Prescription</Text>
            <Text style={styles.historyDate}>Oct 12, 2025 • For Mom</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
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
  },
  uploadCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: spacing.lg,
  },
  uploadIconContainer: {
    backgroundColor: colors.secondary + '20',
    padding: spacing.md,
    borderRadius: borderRadius.pill,
    marginBottom: spacing.md,
  },
  uploadTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  uploadSubtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
  },
  scanningContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  scanningText: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  resultCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    ...shadows.sm,
    marginBottom: spacing.lg,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resultTitle: {
    ...typography.h3,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  confidenceText: {
    ...typography.bodySmall,
    color: colors.success,
    fontWeight: '600',
  },
  warningAlert: {
    flexDirection: 'row',
    backgroundColor: '#FFFAF0',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#FBD38D',
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  warningText: {
    ...typography.bodySmall,
    color: colors.warning,
    marginLeft: spacing.sm,
    flex: 1,
  },
  resultDetails: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.lg,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  resultLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
    flex: 1,
  },
  resultValue: {
    ...typography.label,
    flex: 2,
    textAlign: 'right',
  },
  verifyButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
  },
  verifyButtonText: {
    ...typography.label,
    color: colors.surface,
    fontSize: 16,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  historyInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  historyTitle: {
    ...typography.label,
  },
  historyDate: {
    ...typography.bodySmall,
    marginTop: 2,
  },
});
