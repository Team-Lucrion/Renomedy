import * as Linking from 'expo-linking';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
3
if (!publishableKey) {
  console.error(
    'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add it to your Expo environment before starting the app.',
  );
}

export const clerkPublishableKey = publishableKey;
export const clerkRedirectUrl = Linking.createURL('/sso-callback');
