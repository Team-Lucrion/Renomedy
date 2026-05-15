# Renomedy

React Native health app built with Expo.

## Clerk auth

1. Create a Clerk application and enable the Native API in the Clerk dashboard.
2. Copy [`.env.example`](/C:/Users/Manjunath/Desktop/Rajath/Development/Shared%20Projects/Renomedy/Frontend/.env.example:1) to `.env`.
3. Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to your Clerk publishable key.
4. Set `EXPO_PUBLIC_API_BASE_URL` to your backend base URL.
5. Start the app with `npm run start`.

Google sign-in uses the Expo scheme defined in [app.json](/C:/Users/Manjunath/Desktop/Rajath/Development/Shared%20Projects/Renomedy/Frontend/app.json:1), so keep the `scheme` value aligned with your Clerk redirect configuration.

After Clerk sign-in, the app calls backend `POST /auth/sync-clerk-user` and `GET /users/me` with the Clerk bearer token so the frontend and backend share the same authenticated user record.

For the combined frontend/backend setup flow, use the root [README.md](/C:/Users/Manjunath/Desktop/Rajath/Development/Shared%20Projects/Renomedy/README.md:1).
