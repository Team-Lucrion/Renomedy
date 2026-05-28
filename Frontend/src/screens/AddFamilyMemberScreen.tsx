import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import UpgradeModal from '../components/UpgradeModal';
import { useAppData } from '../context/AppDataContext';
import { findFirst } from '../lib/collections';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'AddFamilyMember'>;

const roleOptions = ['caregiver', 'patient', 'family_member'] as const;
const genderOptions = ['Female', 'Male', 'Other'] as const;
const relationshipOptions = ['Mother', 'Father', 'Spouse', 'Child', 'Grandparent'] as const;

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AddFamilyMemberScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { addFamilyMember, updateFamilyMember, familyMembers } = useAppData();
  const member = useMemo(
    () => findFirst(familyMembers, (item) => item.id === route.params?.memberId),
    [familyMembers, route.params?.memberId],
  );
  const isEditMode = Boolean(member);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [relationship, setRelationship] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [role, setRole] = useState<'caregiver' | 'patient' | 'family_member'>('family_member');
  const [conditions, setConditions] = useState('');
  const [notes, setNotes] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isPrimaryDependent, setIsPrimaryDependent] = useState(false);
  const [error, setError] = useState('');
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!member) {
      setName('');
      setAge('');
      setRelationship('');
      setGender(null);
      setRole('family_member');
      setConditions('');
      setNotes('');
      setAvatarUrl(null);
      setIsPrimaryDependent(false);
      return;
    }

    setName(member.name ?? member.full_name);
    setAge(member.age ? String(member.age) : '');
    setRelationship(member.relationship);
    setGender(member.gender ?? null);
    setRole((member.role as 'caregiver' | 'patient' | 'family_member') ?? 'family_member');
    setConditions((member.chronic_conditions ?? []).join(', '));
    setNotes(member.notes ?? '');
    setAvatarUrl(member.avatar_url ?? null);
    setIsPrimaryDependent(Boolean(member.is_primary_dependent));
  }, [member]);

  const chooseAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(t('memberForm.photoPermission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.7,
      selectionLimit: 1,
    });

    if (!result.canceled && result.assets?.[0]) {
      setAvatarUrl(result.assets[0].uri);
    }
  };

  const validate = () => {
    if (!name.trim()) {
      return t('memberForm.nameRequired');
    }

    if (!relationship.trim()) {
      return t('memberForm.relationshipRequired');
    }

    if (age.trim()) {
      const numericAge = Number(age);
      if (!isFinite(numericAge) || numericAge < 0 || numericAge > 120) {
        return t('memberForm.ageInvalid');
      }
    }

    return '';
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      full_name: name.trim(),
      relationship: relationship.trim(),
      age: age.trim() ? Number(age) : undefined,
      gender: gender ?? undefined,
      role,
      avatar_url: avatarUrl ?? undefined,
      chronic_conditions: splitCsv(conditions),
      allergies: [],
      notes: notes.trim() || undefined,
      is_primary_dependent: isPrimaryDependent || role === 'patient',
    };

    setIsSaving(true);
    setError('');

    try {
      if (member) {
        await updateFamilyMember(member.id, {
          ...payload,
          age: age.trim() ? Number(age) : null,
          gender: gender ?? null,
          avatar_url: avatarUrl ?? null,
          notes: notes.trim() || null,
        });
      } else {
        await addFamilyMember(payload);
      }

      navigation.goBack();
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.statusCode === 402) {
        setUpgradeMessage(saveError.message);
        return;
      }

      setError(saveError instanceof Error ? saveError.message : t('memberForm.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const screenTitle = isEditMode ? t('memberForm.editTitle') : t('memberForm.addTitle');
  const screenDescription = isEditMode ? t('memberForm.editDescription') : t('memberForm.addDescription');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.headerCard}>
          <TouchableOpacity style={styles.avatarButton} onPress={() => void chooseAvatar()}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{name.trim().charAt(0).toUpperCase() || 'F'}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera-outline" size={14} color={colors.surface} />
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>{screenTitle}</Text>
          <Text style={styles.description}>{screenDescription}</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('memberForm.fullName')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('memberForm.namePlaceholder')}
              value={name}
              onChangeText={setName}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inlineFields}>
            <View style={[styles.formGroup, styles.inlineField]}>
              <Text style={styles.label}>{t('memberForm.age')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('memberForm.agePlaceholder')}
                value={age}
                onChangeText={setAge}
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.formGroup, styles.inlineField]}>
              <Text style={styles.label}>{t('memberForm.relationship')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('memberForm.relationshipPlaceholder')}
                value={relationship}
                onChangeText={setRelationship}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('memberForm.quickRelationships')}</Text>
            <View style={styles.optionRow}>
              {relationshipOptions.map((option) => {
                const active = relationship === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.optionChip, active ? styles.optionChipActive : null]}
                    onPress={() => setRelationship(option)}
                  >
                    <Text style={[styles.optionChipText, active ? styles.optionChipTextActive : null]}>
                      {t(`memberForm.relationshipOptions.${option}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('memberForm.role')}</Text>
            <View style={styles.segmentedRow}>
              {roleOptions.map((option) => {
                const active = role === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.segmentedButton, active ? styles.segmentedButtonActive : null]}
                    onPress={() => setRole(option)}
                  >
                    <Text style={[styles.segmentedText, active ? styles.segmentedTextActive : null]}>
                      {t(`memberForm.roles.${option}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('memberForm.gender')}</Text>
            <View style={styles.segmentedRow}>
              {genderOptions.map((option) => {
                const active = gender === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.segmentedButton, active ? styles.segmentedButtonActive : null]}
                    onPress={() => setGender(active ? null : option)}
                  >
                    <Text style={[styles.segmentedText, active ? styles.segmentedTextActive : null]}>
                      {t(`memberForm.genderOptions.${option}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('memberForm.medicationProfile')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('memberForm.medicationProfilePlaceholder')}
              value={conditions}
              onChangeText={setConditions}
              multiline
              numberOfLines={3}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('memberForm.careNotes')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('memberForm.careNotesPlaceholder')}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.switchGroup}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.label}>{t('memberForm.primaryProfile')}</Text>
              <Text style={styles.subLabel}>{t('memberForm.primaryProfileHelp')}</Text>
            </View>
            <Switch
              value={isPrimaryDependent}
              onValueChange={setIsPrimaryDependent}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} disabled={isSaving}>
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={() => void handleSave()} disabled={isSaving}>
              <Text style={styles.saveButtonText}>{isSaving ? t('memberForm.saving') : t('common.saveChanges')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <UpgradeModal
        visible={Boolean(upgradeMessage)}
        title={t('memberForm.upgradeTitle')}
        message={upgradeMessage}
        onClose={() => setUpgradeMessage('')}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 100,
  },
  headerCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.sm,
  },
  avatarButton: {
    marginBottom: spacing.md,
  },
  avatarImage: {
    backgroundColor: colors.inputBackground,
    borderRadius: 44,
    height: 88,
    width: 88,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: `${colors.secondary}30`,
    borderRadius: 44,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  avatarInitial: {
    ...typography.h1,
    color: colors.primary,
  },
  avatarEditBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    bottom: -2,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 28,
  },
  title: {
    ...typography.h2,
    color: colors.primary,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inlineField: {
    flex: 1,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.text,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  textArea: {
    minHeight: 108,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionChip: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionChipActive: {
    backgroundColor: `${colors.secondary}22`,
    borderColor: colors.primary,
  },
  optionChipText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: '700',
  },
  optionChipTextActive: {
    color: colors.primary,
  },
  segmentedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  segmentedButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  segmentedButtonActive: {
    backgroundColor: `${colors.secondary}24`,
    borderColor: colors.primary,
  },
  segmentedText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: '700',
  },
  segmentedTextActive: {
    color: colors.primary,
  },
  switchGroup: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  switchLabelContainer: {
    flex: 1,
  },
  subLabel: {
    ...typography.bodySmall,
    marginTop: 4,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  cancelButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonText: {
    ...typography.label,
    color: colors.surface,
  },
});
