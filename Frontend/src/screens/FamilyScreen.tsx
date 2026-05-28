import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import ConfirmActionModal from '../components/ConfirmActionModal';
import MemberAvatar from '../components/MemberAvatar';
import { useAppData } from '../context/AppDataContext';
import { findFirst } from '../lib/collections';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

function roleLabel(role?: string | null) {
  if (role === 'caregiver') return 'family.roles.caregiver';
  if (role === 'patient') return 'family.roles.patient';
  return 'family.roles.member';
}

export default function FamilyScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { familyGroups, familyMembers, archiveFamilyMember, regenerateInvite } = useAppData();
  const family = familyGroups[0];
  const currentMembership = family?.family_group_memberships?.[0];
  const canManage = currentMembership?.role === 'owner' || currentMembership?.role === 'caregiver';
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRegeneratingInvite, setIsRegeneratingInvite] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const selectedMember = useMemo(
    () => findFirst(familyMembers, (member) => member.id === selectedMemberId),
    [familyMembers, selectedMemberId],
  );

  const handleArchive = async () => {
    if (!selectedMemberId) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsArchiving(true);
    try {
      await archiveFamilyMember(selectedMemberId);
      setSelectedMemberId(null);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleShareInvite = async () => {
    if (!family?.invite_code) {
      return;
    }

    await Share.share({
      message: t('family.shareInvite', {
        familyName: family.family_name,
        inviteCode: family.invite_code,
      }),
    });
  };

  const handleRegenerateInvite = async () => {
    setIsRegeneratingInvite(true);
    try {
      await regenerateInvite();
    } finally {
      setIsRegeneratingInvite(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerBlock}>
          <Text style={styles.title}>{family?.family_name ?? t('family.titleFallback')}</Text>
          <Text style={styles.eyebrow}>{t('family.eyebrow')}</Text>
          <Text style={styles.subtitle}>{t('family.subtitle')}</Text>
        </View>

        {family?.invite_code ? (
          <View style={styles.inviteCard}>
            <Ionicons name="link-outline" size={22} color={colors.primary} />
            <View style={styles.inviteInfo}>
              <Text style={styles.inviteLabel}>{t('family.inviteLabel')}</Text>
              <Text style={styles.inviteCode}>{family.invite_code}</Text>
              {family.invite_expires_at ? (
                <Text style={styles.inviteExpiry}>
                  {t('family.inviteValidUntil', { date: new Date(family.invite_expires_at).toLocaleDateString() })}
                </Text>
              ) : null}
            </View>
            <View style={styles.inviteActions}>
              <TouchableOpacity style={styles.inviteActionButton} onPress={() => void handleShareInvite()}>
                <Ionicons name="share-social-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
              {currentMembership?.role === 'owner' ? (
                <TouchableOpacity style={styles.inviteActionButton} onPress={() => void handleRegenerateInvite()} disabled={isRegeneratingInvite}>
                  <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {canManage ? (
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddFamilyMember')}>
            <Ionicons name="person-add-outline" size={20} color={colors.surface} />
            <Text style={styles.addButtonText}>{t('family.addMember')}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('family.members')}</Text>
          <Text style={styles.countText}>{familyMembers.length}</Text>
        </View>

        {familyMembers.length > 0 ? (
          <View style={styles.memberList}>
            {familyMembers.map((member) => (
              <TouchableOpacity
                key={member.id}
                activeOpacity={0.9}
                style={styles.memberCard}
                onPress={() => navigation.navigate('FamilyMemberDetails', { memberId: member.id })}
              >
                <MemberAvatar avatarUrl={member.avatar_url} name={member.name ?? member.full_name} size={52} />
                <View style={styles.memberInfo}>
                  <View style={styles.memberTopRow}>
                    <Text style={styles.memberName}>{member.name ?? member.full_name}</Text>
                    {member.is_primary_dependent ? (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>{t('family.primary')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.memberMeta}>
                    {member.relationship} | {t(roleLabel(member.role))}
                  </Text>
                  <Text style={styles.statusText}>{member.medication_status ?? t('family.profileReady')}</Text>
                </View>

                <View style={styles.quickActions}>
                  {canManage ? (
                    <>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => navigation.navigate('AddFamilyMember', { memberId: member.id })}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconButton, styles.deleteButton]}
                        onPress={() => setSelectedMemberId(member.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('FamilyMemberDetails', { memberId: member.id })}>
                      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="people-outline" size={34} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('family.firstMemberTitle')}</Text>
            <Text style={styles.emptyText}>{t('family.firstMemberBody')}</Text>
            {canManage ? (
              <TouchableOpacity style={styles.emptyCta} onPress={() => navigation.navigate('AddFamilyMember')}>
                <Text style={styles.emptyCtaText}>{t('family.addMember')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>

      <ConfirmActionModal
        visible={Boolean(selectedMember)}
        title={t('family.removeTitle')}
        message={t('family.removeMessage')}
        confirmLabel={t('family.removeConfirm')}
        loading={isArchiving}
        destructive
        onConfirm={() => void handleArchive()}
        onCancel={() => setSelectedMemberId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    padding: spacing.lg,
    paddingTop: 52,
    paddingBottom: 96,
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.pill,
    height: 48,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: 48,
    ...shadows.sm,
  },
  headerBlock: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
  },
  eyebrow: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 23,
    marginTop: spacing.xs,
  },
  inviteCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteLabel: {
    ...typography.bodySmall,
  },
  inviteCode: {
    ...typography.label,
    color: colors.primary,
    marginTop: 2,
  },
  inviteExpiry: {
    ...typography.bodySmall,
    marginTop: 4,
  },
  inviteActions: {
    gap: spacing.sm,
  },
  inviteActionButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    minHeight: 52,
  },
  addButtonText: {
    ...typography.label,
    color: colors.surface,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
  },
  countText: {
    ...typography.label,
    color: colors.primary,
  },
  memberList: {
    gap: spacing.md,
  },
  memberCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  memberInfo: {
    flex: 1,
  },
  memberTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  memberName: {
    ...typography.label,
    color: colors.text,
    flexShrink: 1,
    fontSize: 16,
  },
  memberMeta: {
    ...typography.bodySmall,
    marginTop: 4,
  },
  statusText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  primaryBadge: {
    backgroundColor: `${colors.success}15`,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  primaryBadgeText: {
    ...typography.bodySmall,
    color: colors.success,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  deleteButton: {
    backgroundColor: '#FFF5F5',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.sm,
  },
  emptyIconWrap: {
    alignItems: 'center',
    backgroundColor: `${colors.secondary}24`,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.bodySmall,
    lineHeight: 20,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  emptyCta: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  emptyCtaText: {
    ...typography.label,
    color: colors.surface,
  },
});
