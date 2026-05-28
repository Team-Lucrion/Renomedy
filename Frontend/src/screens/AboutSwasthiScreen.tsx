import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { APP_BUILD_DATE, APP_VERSION, FEEDBACK_EMAIL } from '../config/appInfo';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AboutSwasthi'>;

export default function AboutSwasthiScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Swasthi</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What Swasthi does</Text>
          <Text style={styles.bodyText}>
            Swasthi helps families turn prescriptions into a medicine routine they can manage at home. It keeps medicine
            names, schedules, dose tracking, refill continuity, and caregiver visibility in one place. The beta is focused
            on Indian chronic-care families who need reliable prescription continuity.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What Swasthi does not do</Text>
          <Text style={styles.bodyText}>
            Swasthi does not diagnose conditions, prescribe medicines, or recommend dosage changes. It does not replace
            your doctor or pharmacist. For medical questions, treatment decisions, or changes to a prescription, always
            consult your doctor.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Who built it and why</Text>
          <Text style={styles.bodyText}>
            Swasthi is built by the Renomedy team for families who coordinate long-term medicines at home. We are building
            the beta to make daily medicine continuity calmer, safer, and easier to share with trusted caregivers.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Feedback</Text>
          <Text style={styles.bodyText}>Send beta feedback to {FEEDBACK_EMAIL}.</Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaText}>Version {APP_VERSION}</Text>
          <Text style={styles.metaText}>Build date {APP_BUILD_DATE}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    ...shadows.sm,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  headerTitle: {
    ...typography.h2,
  },
  scrollContainer: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.h3,
  },
  bodyText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  metaCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  metaText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
