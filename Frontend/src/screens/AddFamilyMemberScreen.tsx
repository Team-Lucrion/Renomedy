import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Switch, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppData } from '../context/AppDataContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, typography, spacing, borderRadius } from '../theme/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddFamilyMember'>;
};

export default function AddFamilyMemberScreen({ navigation }: Props) {
  const { addFamilyMember } = useAppData();
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [relationship, setRelationship] = useState('');
  const [conditions, setConditions] = useState('');
  const [isPrimaryDependent, setIsPrimaryDependent] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !relationship.trim()) {
      setError('Name and relationship are required.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await addFamilyMember({
        full_name: name.trim(),
        relationship: relationship.trim(),
        dob: dob.trim() || undefined,
        chronic_conditions: conditions
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        is_primary_dependent: isPrimaryDependent,
      });

      navigation.goBack();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save family member.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.description}>Add a family member to manage their medications and continuity alerts.</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ramesh"
            value={name}
            onChangeText={setName}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Date of Birth (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={dob}
            onChangeText={setDob}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Relationship</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Father"
            value={relationship}
            onChangeText={setRelationship}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Chronic Conditions (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g. Diabetes, Hypertension"
            value={conditions}
            onChangeText={setConditions}
            multiline
            numberOfLines={3}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.switchGroup}>
          <View style={styles.switchLabelContainer}>
            <Text style={styles.label}>Primary dependent</Text>
            <Text style={styles.subLabel}>Use this for the most critical medication profile in the family group.</Text>
          </View>
          <Switch
            value={isPrimaryDependent}
            onValueChange={setIsPrimaryDependent}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={() => void handleSave()} disabled={isSaving}>
          <Text style={styles.buttonText}>{isSaving ? 'Saving...' : 'Save Family Member'}</Text>
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
  description: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.xl,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
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
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonText: {
    ...typography.label,
    color: colors.surface,
    fontSize: 16,
  },
});
