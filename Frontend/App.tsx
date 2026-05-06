import React from 'react';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { clerkPublishableKey } from './src/lib/clerk';
import { AppDataProvider } from './src/context/AppDataContext';

export default function App() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <AppDataProvider>
          <AppNavigator />
        </AppDataProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
