import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useAuth } from '@clerk/expo';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, typography } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'>;
};

export default function SplashScreen({ navigation }: Props) {
  const { isLoaded, isSignedIn } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      if (!isLoaded) {
        return;
      }

      navigation.replace(isSignedIn ? 'MainTabs' : 'Login');
    }, 2500);

    return () => clearTimeout(timer);
  }, [fadeAnim, isLoaded, isSignedIn, navigation]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Ionicons name="medical" size={80} color={colors.primary} style={styles.logo} />
        <Text style={styles.title}>Swasthi</Text>
        <Text style={styles.subtitle}>Understand. Track. Care.</Text>
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
  },
  logo: {
    marginBottom: 16,
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
});
