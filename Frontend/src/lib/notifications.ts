import { Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";

const PROMPT_KEY = "renomedy_notification_prompt_seen_v1";
const TOKEN_KEY = "renomedy_notification_token_v1";

export type NotificationSetupResult =
  | { status: "registered"; token: string }
  | { status: "denied" }
  | { status: "unsupported"; reason: string }
  | { status: "error"; reason: string };

export async function hasNotificationPromptBeenSeen() {
  return (await SecureStore.getItemAsync(PROMPT_KEY)) === "true";
}

export async function markNotificationPromptSeen() {
  await SecureStore.setItemAsync(PROMPT_KEY, "true");
}

export async function getStoredNotificationToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearStoredNotificationToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function setupMedicationNotifications(registerToken: (input: { fcm_token: string; platform: string }) => Promise<void>): Promise<NotificationSetupResult> {
  try {
    const existingStatus = await Notifications.getPermissionsAsync();
    let status = existingStatus.status;

    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
      await markNotificationPromptSeen();
    }

    if (status !== "granted") {
      return { status: "denied" };
    }

    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    const token = typeof tokenResponse.data === "string" ? tokenResponse.data : "";

    if (!token) {
      return { status: "unsupported", reason: "No device notification token returned." };
    }

    await registerToken({ fcm_token: token, platform: Platform.OS });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return { status: "registered", token };
  } catch (error) {
    return {
      status: "error",
      reason: error instanceof Error ? error.message : "Notification setup failed.",
    };
  }
}

export async function unregisterStoredNotifications(unregisterToken: (fcmToken?: string) => Promise<void>) {
  const token = await getStoredNotificationToken();
  await unregisterToken(token ?? undefined);
  await clearStoredNotificationToken();
}

export function openNotificationSettings() {
  return Linking.openSettings();
}
