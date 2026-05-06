# Swasthi

React Native health app built with Expo.

## Clerk auth

1. Create a Clerk application and enable the Native API in the Clerk dashboard.
2. Copy `.env.example` to `.env`.
3. Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to your Clerk publishable key.
4. Start the app with `npm run start`.

Google sign-in uses the Expo scheme defined in [app.json](/C:/Users/Manjunath/Desktop/Rajath/Development/Shared%20Projects/Swasthi/Frontend/app.json:1), so keep the `scheme` value aligned with your Clerk redirect configuration.
