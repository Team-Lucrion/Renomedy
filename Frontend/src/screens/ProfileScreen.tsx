import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useClerk, useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import ConfirmActionModal from '../components/ConfirmActionModal';
import { useAppData } from '../context/AppDataContext';
import { useLanguage } from '../context/LanguageContext';
import { unregisterStoredNotifications } from '../lib/notifications';
import type { AppLanguage } from '../localization/i18n';
import {
  GUIDED_VERIFICATION_ENABLED_KEY,
  GUIDED_VERIFICATION_FIRST_COMPLETED_KEY,
} from '../utils/verificationPreferences';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

function formatBetaStatus(status?: string | null) {
  if (!status) {
    return 'Pending';
  }

  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const languageOptions: AppLanguage[] = ['en', 'hi', 'kn'];

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { language, setAppLanguage } = useLanguage();
  const { currentUser, familyGroups, familyMembers, refreshAll, error, betaBlocked, leaveSanctuary, unregisterNotificationToken, sendTestPush } = useAppData();
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [guidedVerificationEnabled, setGuidedVerificationEnabled] = useState(true);

  const displayName =
    currentUser?.full_name ??
    user?.fullName ??
    t('profile.defaultName');

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    t('profile.noEmail');

  const currentSanctuary = familyGroups[0] ?? null;

  useEffect(() => {
    let isMounted = true;

    const loadGuidedVerificationPreference = async () => {
      const [explicitPreference, firstCompleted] = await Promise.all([
        AsyncStorage.getItem(GUIDED_VERIFICATION_ENABLED_KEY),
        AsyncStorage.getItem(GUIDED_VERIFICATION_FIRST_COMPLETED_KEY),
      ]);

      if (!isMounted) return;

      setGuidedVerificationEnabled(
        explicitPreference === null ? firstCompleted !== 'true' : explicitPreference === 'true',
      );
    };

    void loadGuidedVerificationPreference();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleGuidedVerificationToggle = async (enabled: boolean) => {
    setGuidedVerificationEnabled(enabled);
    await AsyncStorage.setItem(GUIDED_VERIFICATION_ENABLED_KEY, String(enabled));
  };

  const handleSignOut = async () => {
    await unregisterStoredNotifications(unregisterNotificationToken);
    await signOut();
  };

  const handleLeaveSanctuary = async () => {
    setIsLeaving(true);
    try {
      await leaveSanctuary();
      setShowLeaveConfirm(false);
      setActionMessage(t('profile.leftSanctuary'));
    } catch (leaveError) {
      setActionMessage(leaveError instanceof Error ? leaveError.message : t('profile.leaveFailed'));
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName[0]?.toUpperCase() ?? 'S'}</Text>
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('profile.sanctuaryStatus')}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('profile.currentSanctuary')}</Text>
            <Text style={styles.detailValue}>{currentSanctuary?.family_name ?? t('profile.notJoined')}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('profile.betaAccess')}</Text>
            <Text style={styles.detailValue}>{formatBetaStatus(currentUser?.beta_access_status)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('profile.onboarding')}</Text>
            <Text style={styles.detailValue}>{currentUser?.onboarding_complete ? t('profile.complete') : t('profile.pending')}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('profile.sanctuaries')}</Text>
            <Text style={styles.detailValue}>{familyGroups.length}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('profile.sanctuaryMembers')}</Text>
            <Text style={styles.detailValue}>{familyMembers.length}</Text>
          </View>
          {betaBlocked ? (
            <Text style={styles.noticeText}>{t('profile.blockedNotice')}</Text>
          ) : null}
          {actionMessage ? <Text style={styles.noticeText}>{actionMessage}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('language.sectionTitle')}</Text>
          <Text style={styles.detailLabel}>{t('language.current')}</Text>
          <View style={styles.languageRow}>
            {languageOptions.map((option) => {
              const active = language === option;
              const labelKey =
                option === 'en' ? 'language.english' : option === 'hi' ? 'language.hindi' : 'language.kannada';

              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.languageChip, active ? styles.languageChipActive : null]}
                  onPress={() => void setAppLanguage(option)}
                >
                  <Text style={[styles.languageChipText, active ? styles.languageChipTextActive : null]}>{t(labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Verification</Text>
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>Guided medicine verification</Text>
              <Text style={styles.preferenceDescription}>
                Review one medicine field at a time before saving it to the active plan.
              </Text>
            </View>
            <Switch
              value={guidedVerificationEnabled}
              onValueChange={(value) => void handleGuidedVerificationToggle(value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => void refreshAll()}>
          <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>{t('profile.refreshBackend')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => void sendTestPush()}>
          <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>{t('profile.sendTestPush')}</Text>
        </TouchableOpacity>

        {currentSanctuary ? (
          <TouchableOpacity style={styles.leaveButton} onPress={() => setShowLeaveConfirm(true)}>
            <Text style={styles.leaveText}>{t('profile.leaveSanctuary')}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.logoutButton} onPress={() => void handleSignOut()}>
          <Text style={styles.logoutText}>{t('profile.logOut')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmActionModal
        visible={showLeaveConfirm}
        title={t('profile.leaveTitle')}
        message={t('profile.leaveMessage')}
        confirmLabel={t('profile.leaveSanctuary')}
        destructive
        loading={isLeaving}
        onConfirm={() => void handleLeaveSanctuary()}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerTitle: {
    ...typography.h2,
  },
  scrollContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.lg,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    ...shadows.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    ...typography.h2,
    color: colors.surface,
  },
  profileName: {
    ...typography.h3,
  },
  profileEmail: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.sm,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  detailValue: {
    ...typography.label,
  },
  noticeText: {
    ...typography.bodySmall,
    color: colors.warning,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
  },
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  languageChip: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  languageChipActive: {
    backgroundColor: `${colors.secondary}18`,
    borderColor: colors.primary,
  },
  languageChipText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: '700',
  },
  languageChipTextActive: {
    color: colors.primary,
  },
  preferenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  preferenceCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  preferenceTitle: {
    ...typography.label,
    color: colors.text,
  },
  preferenceDescription: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.pill,
    padding: spacing.md,
    gap: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  leaveButton: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  leaveText: {
    ...typography.label,
    color: colors.warning,
  },
  logoutButton: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  logoutText: {
    ...typography.label,
    color: colors.danger,
  },
});
