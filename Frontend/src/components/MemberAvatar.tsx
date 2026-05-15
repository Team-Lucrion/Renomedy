import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme/theme';

type Props = {
  avatarUrl?: string | null;
  name: string;
  size?: number;
};

export default function MemberAvatar({ avatarUrl, name, size = 56 }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || 'F';

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />;
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initial, { fontSize: Math.max(16, size * 0.36) }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.inputBackground,
  },
  fallback: {
    alignItems: 'center',
    backgroundColor: `${colors.secondary}35`,
    justifyContent: 'center',
  },
  initial: {
    ...typography.label,
    color: colors.primary,
    fontWeight: '700',
  },
});
