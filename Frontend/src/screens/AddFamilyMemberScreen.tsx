import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Switch, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, typography, spacing, borderRadius } from '../theme/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddFamilyMember'>;
};

export default function AddFamilyMemberScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [relationship, setRelationship] = useState('');
  const [conditions, setConditions] = useState('');
  const [isSelfManaged, setIsSelfManaged] = useState(false);

  const handleSave = () => {
    // Mock save
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.description}>Add a family member to manage their medications and get refill alerts.</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput 
            style={styles.input}
            placeholder="e.g. Ramesh"
            value={name}
            onChangeText={setName}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Age</Text>
          <TextInput 
            style={styles.input}
            placeholder="e.g. 65"
            keyboardType="number-pad"
            value={age}
            onChangeText={setAge}
            placeholderTextColor={colors.textMuted}
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
          <Text style={styles.label}>Health Conditions (optional)</Text>
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
            <Text style={styles.label}>Self-managed</Text>
            <Text style={styles.subLabel}>Can they manage their own app usage?</Text>
          </View>
          <Switch 
            value={isSelfManaged} 
            onValueChange={setIsSelfManaged} 
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Save Family Member</Text>
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
