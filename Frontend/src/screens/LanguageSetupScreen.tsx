import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { type AppLanguage } from "../localization/i18n";
import { borderRadius, colors, shadows, spacing, typography } from "../theme/theme";

const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; labelKey: string }> = [
  { value: "en", labelKey: "language.english" },
  { value: "hi", labelKey: "language.hindi" },
  { value: "kn", labelKey: "language.kannada" },
];

export default function LanguageSetupScreen() {
  const { t } = useTranslation();
  const { language, setAppLanguage } = useLanguage();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="language-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>{t("language.title")}</Text>
        <Text style={styles.subtitle}>{t("language.subtitle")}</Text>

        <View style={styles.options}>
          {LANGUAGE_OPTIONS.map((option) => {
            const active = language === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.option, active ? styles.optionActive : null]}
                onPress={() => void setAppLanguage(option.value)}
              >
                <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>{t(option.labelKey)}</Text>
                {active ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.background,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.md,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: `${colors.secondary}28`,
    borderRadius: 30,
    height: 60,
    justifyContent: "center",
    marginBottom: spacing.lg,
    width: 60,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 23,
    marginTop: spacing.sm,
  },
  options: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  option: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.secondary}18`,
  },
  optionText: {
    ...typography.label,
    color: colors.text,
  },
  optionTextActive: {
    color: colors.primary,
  },
});
