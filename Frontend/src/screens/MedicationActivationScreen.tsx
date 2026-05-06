import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MedicationActivation'>;
};

export default function MedicationActivationScreen({ navigation }: Props) {
  const [qty, setQty] = useState('30');
  const [isOngoing, setIsOngoing] = useState(true);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.medCard}>
          <View style={styles.medIcon}>
            <Ionicons name="medical" size={32} color={colors.primary} />
          </View>
          <View style={styles.medInfo}>
            <Text style={styles.medName}>Metformin</Text>
            <Text style={styles.medStrength}>500mg • Tablet</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Inventory Setup</Text>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Quantity Purchased (Tablets)</Text>
          <TextInput 
            style={styles.input}
            keyboardType="number-pad"
            value={qty}
            onChangeText={setQty}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Start Date</Text>
          <View style={styles.inputMock}>
            <Text style={styles.inputText}>Today</Text>
            <Ionicons name="calendar" size={20} color={colors.textMuted} />
          </View>
        </View>

        <View style={styles.switchGroup}>
          <View style={styles.switchLabelContainer}>
            <Text style={styles.label}>Ongoing Medication</Text>
            <Text style={styles.subLabel}>Is this a chronic/long-term medication?</Text>
          </View>
          <Switch 
            value={isOngoing} 
            onValueChange={setIsOngoing} 
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        {!isOngoing && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Duration (Days)</Text>
            <TextInput 
              style={styles.input}
              keyboardType="number-pad"
              placeholder="e.g. 5"
            />
          </View>
        )}

        <View style={styles.predictionCard}>
          <Ionicons name="trending-up" size={24} color={colors.primary} />
          <View style={styles.predictionInfo}>
            <Text style={styles.predictionTitle}>Continuity Prediction</Text>
            <Text style={styles.predictionDesc}>Based on a dose of 2x daily, this supply will last for <Text style={{fontWeight: '700', color: colors.primary}}>15 days</Text>. We will alert you on Day 12.</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.activateButton} onPress={() => navigation.goBack()}>
          <Text style={styles.activateButtonText}>Activate Tracking</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    ...shadows.sm,
    marginBottom: spacing.xl,
  },
  medIcon: {
    backgroundColor: colors.secondary + '30',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    ...typography.h2,
    color: colors.primary,
  },
  medStrength: {
    ...typography.body,
    color: colors.textMuted,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  inputText: {
    ...typography.body,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchLabelContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },
  subLabel: {
    ...typography.bodySmall,
    marginTop: 4,
  },
  predictionCard: {
    flexDirection: 'row',
    backgroundColor: colors.secondary + '20',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  predictionInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  predictionTitle: {
    ...typography.label,
    color: colors.primary,
    marginBottom: 4,
  },
  predictionDesc: {
    ...typography.bodySmall,
    color: colors.text,
    lineHeight: 20,
  },
  activateButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
  },
  activateButtonText: {
    ...typography.label,
    color: colors.surface,
    fontSize: 16,
  },
});
