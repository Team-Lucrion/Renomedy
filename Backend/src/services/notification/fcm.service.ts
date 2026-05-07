import admin from "firebase-admin";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

let initialized = false;

function ensureFirebaseInit() {
  if (initialized || !env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
  initialized = true;
}

export async function sendPushNotification(params: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  ensureFirebaseInit();
  if (!initialized) {
    logger.info("FCM not configured; skipping push delivery");
    return { sent: false, reason: "FCM not configured" };
  }

  const id = await admin.messaging().send({
    token: params.token,
    notification: { title: params.title, body: params.body },
    data: params.data
  });
  return { sent: true, messageId: id };
}

export function isInvalidFcmTokenError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  const nestedCode =
    typeof error === "object" && error && "errorInfo" in error
      ? String((error as { errorInfo?: { code?: unknown } }).errorInfo?.code ?? "")
      : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    code.includes("registration-token-not-registered") ||
    code.includes("invalid-registration-token") ||
    nestedCode.includes("registration-token-not-registered") ||
    nestedCode.includes("invalid-registration-token") ||
    message.includes("not a valid fcm registration token") ||
    message.includes("registration token is not registered")
  );
}
