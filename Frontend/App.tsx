import 'react-native-gesture-handler';
import React from 'react';
import { ClerkProvider } from '@clerk/expo';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { clerkPublishableKey } from './src/lib/clerk';
import { AppDataProvider } from './src/context/AppDataContext';
import { LanguageProvider } from './src/context/LanguageContext';

// tokenCache uses expo-secure-store which is native-only
const getTokenCache = () => {
  if (Platform.OS === 'web') return undefined;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@clerk/expo/token-cache').tokenCache;
};


export default function App() {
  if (!clerkPublishableKey) {
    return (
      <SafeAreaProvider>
        <React.Fragment>
          {/* Placeholder for missing clerk key */}
        </React.Fragment>
      </SafeAreaProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={getTokenCache()}>
      <SafeAreaProvider>
        <LanguageProvider>
          <AppDataProvider>
            <AppNavigator />
          </AppDataProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
