import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';
import * as WebBrowser from 'expo-web-browser';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;

export default function LegalScreen({ navigation }: Props) {
  const openUrl = async (url: string) => {
    await WebBrowser.openBrowserAsync(url);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal & Privacy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Draft Documents</Text>
          <Text style={styles.bodyText}>
            The following documents govern the use of the Swasthi beta.
          </Text>

          <TouchableOpacity style={styles.linkButton} onPress={() => openUrl('https://getrenomedy.netlify.app/privacy')}>
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            <Text style={styles.linkText}>Privacy Policy (Draft)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={() => openUrl('https://getrenomedy.netlify.app/terms')}>
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            <Text style={styles.linkText}>Terms of Service (Draft)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={() => openUrl('https://getrenomedy.netlify.app/beta-terms')}>
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            <Text style={styles.linkText}>Closed Beta Terms (Draft)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    ...shadows.sm,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  headerTitle: {
    ...typography.h2,
  },
  scrollContainer: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    gap: spacing.md,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.h3,
  },
  bodyText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  linkText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  }
});
