import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import kn from "./locales/kn.json";

export const LANGUAGE_STORAGE_KEY = "renomedy_language_v1";
export const SUPPORTED_LANGUAGES = ["en", "hi", "kn"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  kn: { translation: kn },
} as const;

function isSupportedLanguage(value?: string | null): value is AppLanguage {
  return Boolean(value && SUPPORTED_LANGUAGES.includes(value as AppLanguage));
}

export function getDeviceLanguage(): AppLanguage {
  const locale = getLocales()[0];
  const languageCode = locale?.languageCode?.toLowerCase();
  return isSupportedLanguage(languageCode) ? languageCode : "en";
}

export async function getInitialLanguage() {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  const explicitLanguage = isSupportedLanguage(stored) ? stored : null;
  return {
    language: explicitLanguage ?? getDeviceLanguage(),
    hasExplicitPreference: Boolean(explicitLanguage),
  };
}

export async function initializeI18n(language: AppLanguage) {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: "en",
      interpolation: {
        escapeValue: false,
      },
      returnNull: false,
      compatibilityJSON: "v4",
    });
    return i18n;
  }

  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  return i18n;
}

export async function persistLanguage(language: AppLanguage) {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export default i18n;
