import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  dismissDoctorRespectNote,
  DOCTOR_RESPECT_NOTE_TEXT,
  shouldShowDoctorRespectNote,
} from '../utils/doctorRespectNote';
import { borderRadius, colors, spacing, typography } from '../theme/theme';

type Props = {
  style?: ViewStyle;
};

export default function DoctorRespectNote({ style }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;

    const loadVisibility = async () => {
      const shouldShow = await shouldShowDoctorRespectNote();
      if (active) {
        setVisible(shouldShow);
      }
    };

    void loadVisibility();

    return () => {
      active = false;
    };
  }, []);

  const handleDismiss = async () => {
    setVisible(false);
    await dismissDoctorRespectNote();
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.card, style]}>
      <Ionicons name="medical-outline" size={20} color={colors.primary} />
      <Text style={styles.text}>{DOCTOR_RESPECT_NOTE_TEXT}</Text>
      <TouchableOpacity
        accessibilityLabel="Dismiss doctor reminder"
        style={styles.dismissButton}
        onPress={() => void handleDismiss()}
      >
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    backgroundColor: '#F5FBFA',
    borderColor: '#CFE8E2',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  text: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    lineHeight: 22,
  },
  dismissButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    marginRight: -spacing.sm,
    marginTop: -spacing.sm,
  },
});
