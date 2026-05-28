import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useAuth, useUser } from '@clerk/expo';
import { NavigationContainer, type NavigationProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { borderRadius, colors, spacing, typography } from '../theme/theme';
import { useAppData } from '../context/AppDataContext';
import { useLanguage } from '../context/LanguageContext';

// Screens
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import AddFamilyMemberScreen from '../screens/AddFamilyMemberScreen';
import PrescriptionHubScreen from '../screens/PrescriptionHubScreen';
import MedicationActivationScreen from '../screens/MedicationActivationScreen';
import TrackerScreen from '../screens/TrackerScreen';
import ProfileScreen from '../screens/ProfileScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import FamilyScreen from '../screens/FamilyScreen';
import PricingScreen from '../screens/PricingScreen';
import FamilyMemberDetailsScreen from '../screens/FamilyMemberDetailsScreen';
import BetaInviteScreen from '../screens/BetaInviteScreen';
import LanguageSetupScreen from '../screens/LanguageSetupScreen';
import AboutSwasthiScreen from '../screens/AboutSwasthiScreen';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  BetaInvite: undefined;
  Onboarding: undefined;
  LanguageSetup: undefined;
  MainTabs: undefined;
  AddFamilyMember: { memberId?: string } | undefined;
  FamilyMemberDetails: { memberId: string };
  MedicationActivation: { medicationId: string } | undefined;
  AboutSwasthi: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Prescriptions: undefined;
  Medications: undefined;
  Sanctuary: undefined;
  Pricing: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<MainTabParamList>();

function roleLabel(role?: string | null) {
  if (role === 'caregiver') return 'onboarding.roles.caregiverTitle';
  if (role === 'patient') return 'family.roles.patient';
  if (role === 'self') return 'family.roles.patient';
  return 'family.roles.member';
}

function drawerIcon(routeName: keyof MainTabParamList, focused: boolean): keyof typeof Ionicons.glyphMap {
  const icons: Record<keyof MainTabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
    Dashboard: ['grid', 'grid-outline'],
    Prescriptions: ['document-text', 'document-text-outline'],
    Medications: ['medical', 'medical-outline'],
    Sanctuary: ['people', 'people-outline'],
    Pricing: ['card', 'card-outline'],
    Settings: ['settings', 'settings-outline'],
  };

  return focused ? icons[routeName][0] : icons[routeName][1];
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const { user } = useUser();
  const { currentUser, familyGroups, subscriptionSummary } = useAppData();
  const displayName = currentUser?.full_name ?? user?.fullName ?? t('common.appName');
  const familyName = familyGroups[0]?.family_name ?? t('family.titleFallback');
  const planName = subscriptionSummary?.plan?.display_name ?? 'Free';
  const openAboutSwasthi = () => {
    props.navigation.getParent<NavigationProp<RootStackParamList>>()?.navigate('AboutSwasthi');
  };

  return (
    <View style={drawerStyles.container}>
      <View style={drawerStyles.profileBlock}>
        <View style={drawerStyles.avatar}>
          <Text style={drawerStyles.avatarText}>{displayName[0]?.toUpperCase() ?? 'S'}</Text>
        </View>
        <Text style={drawerStyles.name}>{displayName}</Text>
        <Text style={drawerStyles.familyName}>{familyName}</Text>
        <Text style={drawerStyles.planName}>{planName}</Text>
        <View style={drawerStyles.roleBadge}>
          <Text style={drawerStyles.roleBadgeText}>{t(roleLabel(currentUser?.role))}</Text>
        </View>
      </View>

      <View style={drawerStyles.menu}>
        {props.state.routes.map((route, index) => {
          const focused = props.state.index === index;
          const routeName = route.name as keyof MainTabParamList;

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.82}
              onPress={() => props.navigation.navigate(routeName)}
              style={[drawerStyles.menuItem, focused ? drawerStyles.menuItemActive : null]}
            >
              <Ionicons
                name={drawerIcon(routeName, focused)}
                size={20}
                color={focused ? colors.primary : colors.textMuted}
              />
              <Text style={[drawerStyles.menuText, focused ? drawerStyles.menuTextActive : null]}>
                {t(`navigation.${route.name.toLowerCase()}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={openAboutSwasthi}
          style={drawerStyles.menuItem}
        >
          <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
          <Text style={drawerStyles.menuText}>About Swasthi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const MainTabs = () => {
  const { t } = useTranslation();
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ route }) => ({
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.textMuted,
        headerShown: false,
        headerTintColor: colors.primary,
        overlayColor: 'rgba(0, 109, 119, 0.18)',
        sceneContainerStyle: { backgroundColor: colors.background },
        drawerStyle: {
          backgroundColor: colors.surface,
          width: 296,
        },
      })}
    >
      <Drawer.Screen name="Dashboard" component={HomeScreen} options={{ drawerLabel: t('navigation.dashboard') }} />
      <Drawer.Screen name="Prescriptions" component={PrescriptionHubScreen} options={{ drawerLabel: t('navigation.prescriptions') }} />
      <Drawer.Screen name="Medications" component={TrackerScreen} options={{ drawerLabel: t('navigation.medications') }} />
      <Drawer.Screen name="Sanctuary" component={FamilyScreen} options={{ drawerLabel: t('navigation.sanctuary') }} />
      <Drawer.Screen name="Pricing" component={PricingScreen} options={{ drawerLabel: t('navigation.pricing') }} />
      <Drawer.Screen name="Settings" component={ProfileScreen} options={{ drawerLabel: t('navigation.settings') }} />
    </Drawer.Navigator>
  );
};

export default function AppNavigator() {
  const { isReady } = useLanguage();
  const { isLoaded, isSignedIn } = useAuth();
  const { currentUser, isLoading, isOffline, pendingDoseLogCount } = useAppData();
  const betaApproved = Boolean(currentUser?.beta_access_approved || currentUser?.beta_access_status === 'active');

  if (!isReady || !isLoaded || (isSignedIn && isLoading)) {
    // Render splash screen as a loading view outside of the navigator
    // to prevent navigation actions from firing before screens exist
    return <SplashScreen navigation={null as any} />;
  }

  return (
    <View style={appNavigatorStyles.shell}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isSignedIn ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !betaApproved ? (
          <Stack.Screen name="BetaInvite" component={BetaInviteScreen} />
        ) : !currentUser?.onboarding_complete ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <Stack.Screen name="MainTabs" component={MainTabs} />
        )}
        <Stack.Screen name="LanguageSetup" component={LanguageSetupScreen} />
        <Stack.Screen name="AddFamilyMember" component={AddFamilyMemberScreen} options={{ headerShown: true, title: '', headerTintColor: colors.primary, headerShadowVisible: false }} />
        <Stack.Screen name="FamilyMemberDetails" component={FamilyMemberDetailsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MedicationActivation" component={MedicationActivationScreen} options={{ headerShown: true, title: '', headerTintColor: colors.primary, headerShadowVisible: false }} />
        <Stack.Screen name="AboutSwasthi" component={AboutSwasthiScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
      {isOffline ? (
        <View pointerEvents="none" style={appNavigatorStyles.offlineBanner}>
          <Text style={appNavigatorStyles.offlineText}>
            You're offline — changes will sync when you reconnect.
            {pendingDoseLogCount > 0 ? ` ${pendingDoseLogCount} dose change${pendingDoseLogCount === 1 ? '' : 's'} waiting.` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const appNavigatorStyles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  offlineBanner: {
    backgroundColor: '#F5FBFA',
    borderColor: '#CFE8E2',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    bottom: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    position: 'absolute',
    right: spacing.md,
  },
  offlineText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
    textAlign: 'center',
  },
});

const drawerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: 58,
  },
  profileBlock: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: spacing.lg,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 56,
  },
  avatarText: {
    ...typography.h3,
    color: colors.surface,
  },
  name: {
    ...typography.h3,
  },
  familyName: {
    ...typography.bodySmall,
    marginTop: 4,
  },
  planName: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.secondary}28`,
    borderRadius: borderRadius.pill,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  roleBadgeText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  menu: {
    gap: spacing.xs,
    paddingTop: spacing.lg,
  },
  menuItem: {
    alignItems: 'center',
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  menuItemActive: {
    backgroundColor: `${colors.secondary}22`,
  },
  menuText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 15,
  },
  menuTextActive: {
    color: colors.primary,
  },
});
