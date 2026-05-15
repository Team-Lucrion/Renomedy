import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useAuth } from '@clerk/expo';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, typography } from '../theme/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'>;
};

export default function SplashScreen({ navigation }: Props) {
  const { isLoaded, isSignedIn } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: false,
    }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.92,
          duration: 900,
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [fadeAnim, pulseAnim]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: pulseAnim }] }]}>
          <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
        </Animated.View>
        <Text style={styles.title}>Renomedy</Text>
        <Text style={styles.subtitle}>Your Family&apos;s Private Care Space</Text>
        <View style={styles.loadingTrack}>
          <Animated.View style={[styles.loadingFill, { opacity: fadeAnim }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  logoWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 32,
    height: 128,
    justifyContent: 'center',
    marginBottom: 22,
    width: 128,
  },
  logo: {
    height: 104,
    width: 104,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.h3,
    color: colors.textMuted,
    fontWeight: '400',
  },
  loadingTrack: {
    backgroundColor: `${colors.secondary}35`,
    borderRadius: 999,
    height: 4,
    marginTop: 28,
    overflow: 'hidden',
    width: 112,
  },
  loadingFill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 4,
    width: '72%',
  },
});
