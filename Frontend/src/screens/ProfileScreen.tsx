import React from 'react';
import { useClerk, useUser } from '@clerk/expo';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { familyMembers } from '../data/mockData';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { signOut } = useClerk();
  const { user } = useUser();

  const handleLogout = async () => {
    await signOut();
  };

  const renderSettingItem = (icon: keyof typeof Ionicons.glyphMap, title: string, subtitle?: string, hasArrow: boolean = true) => (
    <TouchableOpacity style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {hasArrow && <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* User Profile */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ?? 'A'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.fullName ?? 'Swasthi User'}</Text>
            <Text style={styles.profileEmail}>{user?.primaryEmailAddress?.emailAddress ?? 'No email available'}</Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Family Management */}
        <Text style={styles.sectionTitle}>Family Management</Text>
        <View style={styles.card}>
          {familyMembers.map((member, index) => (
            <View key={member.id} style={[styles.familyMemberItem, index < familyMembers.length - 1 && styles.borderBottom]}>
              <View style={styles.memberAvatar}>
                <Ionicons name="person" size={16} color={colors.surface} />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberRel}>{member.relationship}</Text>
              </View>
              <TouchableOpacity>
                <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity 
            style={styles.addMemberBtn}
            onPress={() => navigation.navigate('AddFamilyMember')}
          >
            <Ionicons name="add" size={20} color={colors.primary} />
            <Text style={styles.addMemberText}>Add Family Member</Text>
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          {renderSettingItem('people', 'Caregiver Permissions', 'Manage who can view health data')}
          <View style={styles.divider} />
          {renderSettingItem('notifications', 'Notifications', 'Alerts, refills, and reminders')}
          <View style={styles.divider} />
          {renderSettingItem('lock-closed', 'Privacy & Security', 'App lock, data sharing')}
        </View>

        {/* Support */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.card}>
          {renderSettingItem('help-circle', 'Help Center')}
          <View style={styles.divider} />
          {renderSettingItem('document-text', 'Medical Disclaimer', 'Swasthi is not a replacement for medical advice')}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={() => void handleLogout()}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Swasthi Version 1.0.0</Text>
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.h2,
    color: colors.surface,
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    ...typography.h3,
  },
  profileEmail: {
    ...typography.bodySmall,
  },
  editButton: {
    backgroundColor: colors.secondary + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  editButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    ...shadows.sm,
    marginBottom: spacing.xl,
  },
  familyMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberAvatar: {
    backgroundColor: colors.secondary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  memberName: {
    ...typography.label,
  },
  memberRel: {
    ...typography.bodySmall,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addMemberText: {
    ...typography.label,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  settingIcon: {
    backgroundColor: colors.inputBackground,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  settingInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  settingTitle: {
    ...typography.label,
  },
  settingSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 60, // Align with text
  },
  logoutButton: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    marginBottom: spacing.xl,
  },
  logoutText: {
    ...typography.label,
    color: colors.danger,
  },
  versionText: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
