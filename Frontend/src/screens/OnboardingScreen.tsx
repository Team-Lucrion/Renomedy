import React, { useMemo, useState } from 'react';
import {
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
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';
import { useAppData } from '../context/AppDataContext';
import type { InvitePreview } from '../types/backend';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

type OnboardingRole = 'caregiver' | 'family_member' | 'patient';
type OnboardingMode = 'create' | 'join';

const roles: Array<{
  id: OnboardingRole;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    id: 'caregiver',
    title: 'Care Manager',
    subtitle: 'I manage medicines for my family',
    icon: 'people-outline',
  },
  {
    id: 'family_member',
    title: 'Joining Family Care',
    subtitle: "I am joining my family's care space",
    icon: 'heart-outline',
  },
  {
    id: 'patient',
    title: 'My Medicines',
    subtitle: 'I want help staying on track with my medicines',
    icon: 'medical-outline',
  },
];

export default function OnboardingScreen() {
  const { user } = useUser();
  const { completeOnboarding, joinSanctuary, validateInvite } = useAppData();
  const defaultFamilyName = useMemo(() => {
    const firstName = user?.firstName ?? user?.fullName?.split(' ')[0] ?? '';
    return firstName ? `${firstName}'s Sanctuary` : 'My Sanctuary';
  }, [user?.firstName, user?.fullName]);

  const [mode, setMode] = useState<OnboardingMode>('create');
  const [familyName, setFamilyName] = useState(defaultFamilyName);
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>('caregiver');
  const [inviteFamilyLater, setInviteFamilyLater] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [isCheckingInvite, setIsCheckingInvite] = useState(false);

  const handleCreate = async () => {
    if (!familyName.trim()) {
      setError('Enter a sanctuary name.');
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      await completeOnboarding({
        familyName,
        role: selectedRole,
        inviteFamilyLater,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to finish onboarding.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('Enter an invite code.');
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      await joinSanctuary(inviteCode.trim().toUpperCase(), selectedRole);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to join sanctuary.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteChange = async (text: string) => {
    const normalized = text.toUpperCase();
    setInviteCode(normalized);
    setInvitePreview(null);

    if (normalized.trim().length < 8) {
      return;
    }

    setIsCheckingInvite(true);
    try {
      const preview = await validateInvite(normalized);
      setInvitePreview(preview);
      setError(preview.expired ? 'This invite code has expired. Ask the sanctuary admin for a new one.' : '');
    } catch (previewError) {
      setInvitePreview(null);
      setError(previewError instanceof Error ? previewError.message : 'Invalid sanctuary invite code.');
    } finally {
      setIsCheckingInvite(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Set up your sanctuary</Text>
          <Text style={styles.subtitle}>
            Renomedy helps your family never miss a medicine, never misread a prescription.
          </Text>
        </View>

        <View style={styles.explainerCard}>
          <Text style={styles.explainerEyebrow}>Your Family&apos;s Private Care Space</Text>
          <Text style={styles.explainerTitle}>Build one calm place for prescriptions, medicines, and reminders.</Text>
          <Text style={styles.explainerBody}>
            Create a new sanctuary for your family or join one that has already been shared with you.
          </Text>
        </View>

        <View style={styles.modeToggle}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => { setMode('create'); setError(''); }}
            style={[styles.modeButton, mode === 'create' ? styles.modeButtonActive : null]}
          >
            <Ionicons name="add-circle-outline" size={18} color={mode === 'create' ? colors.surface : colors.primary} />
            <Text style={[styles.modeButtonText, mode === 'create' ? styles.modeButtonTextActive : null]}>Create New</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => { setMode('join'); setError(''); }}
            style={[styles.modeButton, mode === 'join' ? styles.modeButtonActive : null]}
          >
            <Ionicons name="enter-outline" size={18} color={mode === 'join' ? colors.surface : colors.primary} />
            <Text style={[styles.modeButtonText, mode === 'join' ? styles.modeButtonTextActive : null]}>Join Existing</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panel}>
          {mode === 'create' ? (
            <>
              <Text style={styles.label}>Sanctuary name</Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={setFamilyName}
                placeholder="The Sharma Sanctuary"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={familyName}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Invite code</Text>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={(text) => void handleInviteChange(text)}
                placeholder="ABCD1234"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={inviteCode}
              />
              <Text style={styles.helperText}>Enter the code shared by your sanctuary admin.</Text>
              {isCheckingInvite ? <Text style={styles.helperText}>Checking sanctuary invite...</Text> : null}
              {invitePreview ? (
                <View style={[styles.previewCard, invitePreview.valid ? null : styles.previewCardExpired]}>
                  <Text style={styles.previewEyebrow}>You are joining</Text>
                  <Text style={styles.previewTitle}>{invitePreview.sanctuary_name}</Text>
                  <Text style={styles.previewBody}>
                    {invitePreview.valid
                      ? 'You will get access to your family’s shared care space for prescriptions and reminders.'
                      : 'This invite has expired. Ask the sanctuary admin to regenerate the code.'}
                  </Text>
                </View>
              ) : null}
            </>
          )}

          <Text style={[styles.label, styles.roleLabel]}>How are you joining?</Text>
          <View style={styles.roleGrid}>
            {roles.map((role) => {
              const isActive = selectedRole === role.id;

              return (
                <TouchableOpacity
                  key={role.id}
                  activeOpacity={0.86}
                  onPress={() => setSelectedRole(role.id)}
                  style={[styles.roleCard, isActive ? styles.roleCardActive : null]}
                >
                  <View style={[styles.roleIcon, isActive ? styles.roleIconActive : null]}>
                    <Ionicons
                      name={role.icon}
                      size={22}
                      color={isActive ? colors.surface : colors.primary}
                    />
                  </View>
                  <Text style={styles.roleTitle}>{role.title}</Text>
                  <Text style={styles.roleSubtitle}>{role.subtitle}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.inviteRow}>
            <View style={styles.inviteText}>
              <Text style={styles.inviteTitle}>Invite family later</Text>
              <Text style={styles.inviteSubtitle}>You can add parents, spouse, or children after setup.</Text>
            </View>
            <Switch
              onValueChange={setInviteFamilyLater}
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor={inviteFamilyLater ? colors.primary : colors.surface}
              value={inviteFamilyLater}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            disabled={isSaving}
            onPress={() => void (mode === 'create' ? handleCreate() : handleJoin())}
            style={[styles.continueButton, isSaving ? styles.disabledButton : null]}
          >
            <Text style={styles.continueText}>{isSaving ? 'Please wait...' : mode === 'create' ? 'Create Sanctuary' : 'Join Sanctuary'}</Text>
            <Ionicons name="arrow-forward" size={19} color={colors.surface} />
          </TouchableOpacity>
        </View>
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
    padding: spacing.lg,
    paddingTop: 54,
  },
  hero: {
    marginBottom: spacing.xl,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: `${colors.secondary}28`,
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: 60,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    lineHeight: 34,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 23,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  explainerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  explainerEyebrow: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  explainerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  explainerBody: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
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
  roleLabel: {
    marginTop: spacing.lg,
  },
  roleGrid: {
    gap: spacing.sm,
  },
  roleCard: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  roleCardActive: {
    backgroundColor: `${colors.secondary}18`,
    borderColor: colors.primary,
  },
  roleIcon: {
    alignItems: 'center',
    backgroundColor: `${colors.primary}10`,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  roleIconActive: {
    backgroundColor: colors.primary,
  },
  roleTitle: {
    ...typography.label,
    width: 116,
  },
  roleSubtitle: {
    ...typography.bodySmall,
    flex: 1,
    lineHeight: 19,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeButtonText: {
    ...typography.label,
    color: colors.primary,
    fontSize: 14,
  },
  modeButtonTextActive: {
    color: colors.surface,
  },
  helperText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  previewCard: {
    backgroundColor: `${colors.secondary}14`,
    borderColor: `${colors.secondary}60`,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  previewCardExpired: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FEB2B2',
  },
  previewEyebrow: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  previewTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xs,
  },
  previewBody: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  inviteRow: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  inviteText: {
    flex: 1,
  },
  inviteTitle: {
    ...typography.label,
  },
  inviteSubtitle: {
    ...typography.bodySmall,
    marginTop: 3,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
    marginTop: spacing.md,
  },
  continueButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 54,
  },
  disabledButton: {
    opacity: 0.72,
  },
  continueText: {
    ...typography.label,
    color: colors.surface,
    fontSize: 16,
  },
});
