import React, { useEffect, useState } from 'react';
import { useSignIn, useSignUp, useSSO } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import {
  Image,
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
import { borderRadius, colors, shadows, spacing } from '../theme/theme';
import { clerkRedirectUrl } from '../lib/clerk';

WebBrowser.maybeCompleteAuthSession();

type AuthMode = 'signUp' | 'signIn';

const splitName = (fullName: string) => {
  const trimmedName = fullName.trim();

  if (!trimmedName) {
    return { firstName: '', lastName: '' };
  }

  const [firstName, ...rest] = trimmedName.split(/\s+/);

  return {
    firstName,
    lastName: rest.join(' '),
  };
};

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('signUp');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn() as any;
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp() as any;
  const { startSSOFlow } = useSSO();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      void WebBrowser.warmUpAsync();
      return () => {
        void WebBrowser.coolDownAsync();
      };
    }
    return undefined;
  }, []);

  const resetErrorAndSwitchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
  };

  const handlePrimaryAuth = async () => {
    if (!isSignInLoaded || !isSignUpLoaded) {
      return;
    }

    if (mode === 'signUp' && !fullName.trim()) {
      setError('Enter your full name.');
      return;
    }

    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      if (mode === 'signIn') {
        const signInAttempt = await signIn.create({
          identifier: email.trim(),
          password,
        } as any);

        if (signInAttempt.status === 'complete') {
          await setSignInActive({ session: signInAttempt.createdSessionId });
          return;
        }

        setError('Unable to complete sign in.');
        return;
      }

      const { firstName, lastName } = splitName(fullName);
      const signUpAttempt = await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        unsafeMetadata: {
          fullName: fullName.trim(),
        },
      } as any);

      if (signUpAttempt.status === 'complete') {
        await setSignUpActive({ session: signUpAttempt.createdSessionId });
        return;
      }

      setError('Account created but additional verification is required in Clerk.');
    } catch (authError: any) {
      setError(authError?.errors?.[0]?.longMessage ?? 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setIsLoading(true);

    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: clerkRedirectUrl,
        unsafeMetadata: mode === 'signUp' && fullName.trim()
          ? { fullName: fullName.trim() }
          : undefined,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        return;
      }

      setError('Google authentication could not be completed.');
    } catch (oauthError: any) {
      setError(oauthError?.errors?.[0]?.longMessage ?? 'Google authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const isSignUp = mode === 'signUp';
  const title = isSignUp ? 'Create your family sanctuary.' : 'Welcome back to the sanctuary.';
  const subtitle = isSignUp
    ? 'Begin a journey of safe medication synchronization for your loved ones.'
    : "Authorized access only. Log in to manage your family's health continuity.";
  const primaryButtonLabel = isLoading
    ? 'Please wait...'
    : isSignUp
      ? 'Create Sanctuary'
      : 'Enter Sanctuary';
  const googleButtonLabel = isLoading
    ? 'Please wait...'
    : isSignUp
      ? 'Continue with Google'
      : 'Sign in with Google';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.heroSection}>
            <View style={styles.logoWrap}>
              <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.brand}>Renomedy</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.formSection}>
            {isSignUp ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>FULL NAME</Text>
                <TextInput
                  autoCapitalize="words"
                  autoComplete="name"
                  placeholder="Arjun Sharma"
                  placeholderTextColor={stylesConstants.placeholder}
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>FAMILY EMAIL ADDRESS</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="arjun@gmail.com"
                placeholderTextColor={stylesConstants.placeholder}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {isSignUp ? 'SECURE SANCTUARY PASSWORD' : 'SECURE SANCTUARY PASSWORD'}
              </Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  autoCapitalize="none"
                  autoComplete={isSignUp ? 'new-password' : 'password'}
                  placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
                  placeholderTextColor={stylesConstants.placeholder}
                  secureTextEntry
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                />
                {!isSignUp ? (
                  <View style={styles.inlineIcon}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.secondary} />
                  </View>
                ) : null}
              </View>
              {!isSignUp ? (
                <Text style={styles.helperText}>USED FOR CRITICAL MEDICATION UPDATES</Text>
              ) : null}
            </View>

            {!!error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <View style={styles.actionsSection}>
            <TouchableOpacity
              disabled={isLoading}
              style={styles.primaryButton}
              onPress={() => void handlePrimaryAuth()}
            >
              <Ionicons
                color={colors.surface}
                name={isSignUp ? 'person-add-outline' : 'log-in-outline'}
                size={22}
                style={styles.primaryButtonIcon}
              />
              <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={isLoading}
              style={styles.googleButton}
              onPress={() => void handleGoogleAuth()}
            >
              <Ionicons color={colors.primary} name="logo-google" size={20} style={styles.googleButtonIcon} />
              <Text style={styles.googleButtonText}>{googleButtonLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={isLoading}
              style={styles.switchModeButton}
              onPress={() => resetErrorAndSwitchMode(isSignUp ? 'signIn' : 'signUp')}
            >
              <Text style={styles.switchModeText}>
                {isSignUp ? 'ACCESS EXISTING SANCTUARY' : 'ESTABLISH NEW SANCTUARY'}
              </Text>
            </TouchableOpacity>

            <View style={styles.securityRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.secondary} />
              <Text style={styles.securityText}>SECURE 256-BIT ENCRYPTION</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const stylesConstants = {
  placeholder: '#C9D4E3',
  label: '#90A3C8',
  subtitle: '#5F7298',
  softSurface: '#F8FBFF',
  securityText: '#9AA0A8',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },
  heroSection: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  logoWrap: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 26,
    height: 86,
    justifyContent: 'center',
    marginBottom: 18,
    width: 86,
  },
  logo: {
    height: 68,
    width: 68,
  },
  brand: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 10,
  },
  title: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.7,
    marginBottom: 18,
  },
  subtitle: {
    color: stylesConstants.subtitle,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 280,
  },
  formSection: {
    marginTop: 28,
    gap: 26,
  },
  fieldGroup: {
    gap: 10,
  },
  fieldLabel: {
    color: stylesConstants.label,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 3.1,
  },
  input: {
    backgroundColor: stylesConstants.softSurface,
    borderRadius: borderRadius.lg,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 26,
    paddingVertical: 20,
  },
  passwordWrap: {
    alignItems: 'center',
    backgroundColor: stylesConstants.softSurface,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    paddingRight: 20,
  },
  passwordInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 26,
    paddingVertical: 20,
  },
  inlineIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    color: stylesConstants.label,
    fontSize: 10,
    letterSpacing: 2.4,
    marginTop: 2,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  actionsSection: {
    marginTop: 28,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 62,
    paddingHorizontal: spacing.lg,
    ...shadows.md,
  },
  primaryButtonIcon: {
    marginRight: 12,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 58,
    paddingHorizontal: spacing.lg,
  },
  googleButtonIcon: {
    marginRight: 10,
  },
  googleButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  switchModeButton: {
    alignItems: 'center',
    marginTop: 26,
  },
  switchModeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 3.6,
  },
  securityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  securityText: {
    color: stylesConstants.securityText,
    fontSize: 11,
    letterSpacing: 3.2,
    marginLeft: 10,
  },
});
