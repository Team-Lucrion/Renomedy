import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';
import { useAppData } from '../context/AppDataContext';
import { setPendingFirstMedicineFlow, type PendingFirstMedicineFlow } from '../utils/onboardingFlow';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

type OnboardingStep = 1 | 2 | 3;
type AuthMethod = 'phone' | 'google';
type Relationship = 'Myself' | 'Parent' | 'Spouse' | 'Child' | 'Other';

const RELATIONSHIPS: Relationship[] = ['Myself', 'Parent', 'Spouse', 'Child', 'Other'];

export default function OnboardingScreen() {
  const { user } = useUser();
  const { completeOnboarding } = useAppData();
  const defaultName = useMemo(() => user?.fullName ?? user?.firstName ?? '', [user?.firstName, user?.fullName]);
  const [step, setStep] = useState<OnboardingStep>(1);
  const [accountName, setAccountName] = useState(defaultName);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [patientName, setPatientName] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('Parent');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const finishOnboarding = async (flow?: PendingFirstMedicineFlow, skippedFirstPatient = false) => {
    if (!accountName.trim()) {
      setError('Enter your name to continue.');
      setStep(1);
      return;
    }

    if (!skippedFirstPatient && !patientName.trim()) {
      setError('Enter the patient name or skip for now.');
      setStep(2);
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (flow) {
        await setPendingFirstMedicineFlow(flow);
      }

      await completeOnboarding({
        accountName,
        patientName,
        relationship,
        skippedFirstPatient,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to finish onboarding.');
    } finally {
      setIsSaving(false);
    }
  };

  const continueFromStepOne = () => {
    if (!accountName.trim()) {
      setError('Enter your name to continue.');
      return;
    }

    setError('');
    setStep(2);
  };

  const continueFromStepTwo = () => {
    if (!patientName.trim()) {
      setError('Enter the patient name or skip for now.');
      return;
    }

    setError('');
    setStep(3);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepText}>Step {step} of 3</Text>

        {step === 1 ? (
          <View style={styles.panel}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setAccountName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={accountName}
            />

            <Text style={styles.label}>Sign-in method</Text>
            <View style={styles.optionGrid}>
              {(['phone', 'google'] as AuthMethod[]).map((method) => {
                const active = authMethod === method;
                return (
                  <TouchableOpacity
                    key={method}
                    activeOpacity={0.86}
                    onPress={() => setAuthMethod(method)}
                    style={[styles.methodButton, active ? styles.methodButtonActive : null]}
                  >
                    <Ionicons
                      name={method === 'phone' ? 'call-outline' : 'logo-google'}
                      size={20}
                      color={active ? colors.surface : colors.primary}
                    />
                    <Text style={[styles.methodText, active ? styles.methodTextActive : null]}>
                      {method === 'phone' ? 'Phone number' : 'Google'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity disabled={isSaving} style={styles.primaryButton} onPress={continueFromStepOne}>
              <Text style={styles.primaryButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={19} color={colors.surface} />
            </TouchableOpacity>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.panel}>
            <Text style={styles.title}>Who are you managing medicines for?</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setPatientName}
              placeholder="Patient name"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={patientName}
            />

            <Text style={styles.label}>Relationship</Text>
            <View style={styles.optionWrap}>
              {RELATIONSHIPS.map((item) => (
                <TouchableOpacity
                  key={item}
                  activeOpacity={0.86}
                  onPress={() => setRelationship(item)}
                  style={[styles.optionChip, relationship === item ? styles.optionChipSelected : null]}
                >
                  <Text style={[styles.optionChipText, relationship === item ? styles.optionChipTextSelected : null]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity disabled={isSaving} style={styles.primaryButton} onPress={continueFromStepTwo}>
              <Text style={styles.primaryButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={19} color={colors.surface} />
            </TouchableOpacity>
            <TouchableOpacity
              disabled={isSaving}
              style={styles.skipButton}
              onPress={() => void finishOnboarding(undefined, true)}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.panel}>
            <Text style={styles.title}>Add your first medicine</Text>
            <View style={styles.entryOptions}>
              <TouchableOpacity
                disabled={isSaving}
                style={styles.entryOptionButton}
                onPress={() => void finishOnboarding('upload')}
              >
                <Ionicons name="cloud-upload-outline" size={24} color={colors.surface} />
                <View style={styles.entryOptionCopy}>
                  <Text style={styles.entryOptionTitle}>Upload Prescription Photo</Text>
                  <Text style={styles.entryOptionSubtitle}>uses OCR assist</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isSaving}
                style={styles.entryOptionButton}
                onPress={() => void finishOnboarding('manual')}
              >
                <Ionicons name="create-outline" size={24} color={colors.surface} />
                <View style={styles.entryOptionCopy}>
                  <Text style={styles.entryOptionTitle}>Add Medicine Manually</Text>
                  <Text style={styles.entryOptionSubtitle}>type details in</Text>
                </View>
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity disabled={isSaving} style={styles.skipButton} onPress={() => void finishOnboarding()}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  stepText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.md,
  },
  title: {
    ...typography.h2,
    color: colors.primary,
    lineHeight: 30,
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.text,
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
  optionGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  methodButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  methodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodText: {
    ...typography.label,
    color: colors.primary,
  },
  methodTextActive: {
    color: colors.surface,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionChip: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  optionChipSelected: {
    backgroundColor: `${colors.primary}14`,
    borderColor: colors.primary,
  },
  optionChipText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  optionChipTextSelected: {
    color: colors.primary,
  },
  entryOptions: {
    gap: spacing.md,
  },
  entryOptionButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 78,
    padding: spacing.md,
  },
  entryOptionCopy: {
    flex: 1,
  },
  entryOptionTitle: {
    ...typography.label,
    color: colors.surface,
    fontSize: 16,
  },
  entryOptionSubtitle: {
    ...typography.bodySmall,
    color: '#D9F2EF',
    marginTop: 2,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 54,
  },
  primaryButtonText: {
    ...typography.label,
    color: colors.surface,
    fontSize: 16,
  },
  skipButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  skipButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
    marginTop: spacing.md,
  },
});
