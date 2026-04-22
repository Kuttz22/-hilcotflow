/**
 * Push Notification Service
 *
 * Supports three delivery channels:
 *  1. Firebase Cloud Messaging (FCM) — Android and Web
 *  2. Apple Push Notification Service (APNs) — iOS via FCM Admin SDK
 *  3. Manus built-in notifyOwner — fallback when no device tokens are registered
 *
 * Firebase credentials are loaded from the FIREBASE_SERVICE_ACCOUNT_JSON
 * environment variable (full service account JSON blob).
 *
 * If Firebase is not configured, the service falls back gracefully to the
 * Manus notification system so reminders still reach the project owner.
 */

import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { deviceTokens, users } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

// ─── Firebase Admin Initialization ────────────────────────────────────────────

let firebaseApp: import("firebase-admin/app").App | null = null;

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    console.warn(
      "[PushNotifications] Firebase credentials not configured. " +
        "Set FIREBASE_SERVICE_ACCOUNT_JSON to enable FCM/APNs push."
    );
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);

    // Normalize PEM headers — some secret stores strip the spaces from
    // "-----BEGIN PRIVATE KEY-----" → "-----BEGINPRIVATEKEY-----"
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key
        .replace("-----BEGINPRIVATEKEY-----", "-----BEGIN PRIVATE KEY-----")
        .replace("-----ENDPRIVATEKEY-----", "-----END PRIVATE KEY-----")
        .replace("-----BEGINRSAPRIVATEKEY-----", "-----BEGIN RSA PRIVATE KEY-----")
        .replace("-----ENDRSAPRIVATEKEY-----", "-----END RSA PRIVATE KEY-----");
    }

    const admin = require("firebase-admin");
    if (admin.apps.length > 0) {
      firebaseApp = admin.apps[0];
    } else {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    console.info(
      `[PushNotifications] Firebase Admin SDK initialized for project: ${serviceAccount.project_id}`
    );
    return firebaseApp;
  } catch (err) {
    console.error("[PushNotifications] Failed to initialize Firebase:", err);
    return null;
  }
}

// ─── Payload Type ─────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  taskId: number;
  data?: Record<string, string>;
}

// ─── Device Token Helpers ─────────────────────────────────────────────────────

export async function getTokensForUsers(userIds: number[]) {
  if (userIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(deviceTokens)
    .where(inArray(deviceTokens.userId, userIds));
}

export async function registerDeviceToken(
  userId: number,
  token: string,
  platform: "web" | "android" | "ios"
) {
  const db = await getDb();
  if (!db) return;
  // Upsert: if this exact token already exists, update its timestamp
  await db
    .insert(deviceTokens)
    .values({ userId, token, platform })
    .onDuplicateKeyUpdate({ set: { platform, updatedAt: new Date() } });
}

export async function removeDeviceToken(token: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(deviceTokens).where(eq(deviceTokens.token, token));
}

// ─── Core Send Function ───────────────────────────────────────────────────────

/**
 * Send a push notification to a list of user IDs.
 * Uses FCM for web/android tokens and FCM's APNs bridge for iOS tokens.
 * Falls back to Manus notifyOwner if no device tokens are registered.
 */
export async function sendPushToUsers(
  userIds: number[],
  payload: PushPayload
): Promise<{ sent: number; failed: number; fallback: boolean }> {
  const tokens = await getTokensForUsers(userIds);

  // No device tokens registered — fall back to Manus notification
  if (tokens.length === 0) {
    try {
      await notifyOwner({
        title: payload.title,
        content: `${payload.body}\n\nTask ID: ${payload.taskId}`,
      });
    } catch (_) {
      // Non-fatal
    }
    return { sent: 0, failed: 0, fallback: true };
  }

  const app = getFirebaseApp();
  if (!app) {
    // Firebase not configured — fall back to Manus notification
    try {
      await notifyOwner({
        title: payload.title,
        content: `${payload.body}\n\nTask ID: ${payload.taskId}`,
      });
    } catch (_) {}
    return { sent: 0, failed: 0, fallback: true };
  }

  const admin = require("firebase-admin");
  const messaging = admin.messaging(app);

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  for (const tokenRow of tokens) {
    try {
      const message: Record<string, unknown> = {
        token: tokenRow.token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          taskId: String(payload.taskId),
          ...(payload.data ?? {}),
        },
      };

      // iOS-specific APNs config
      if (tokenRow.platform === "ios") {
        message.apns = {
          payload: {
            aps: {
              alert: { title: payload.title, body: payload.body },
              sound: "default",
              badge: 1,
            },
          },
        };
      }

      // Android-specific config
      if (tokenRow.platform === "android") {
        message.android = {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "task_reminders",
          },
        };
      }

      // Web push config
      if (tokenRow.platform === "web") {
        message.webpush = {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            data: { taskId: payload.taskId },
          },
        };
      }

      await messaging.send(message);
      sent++;
    } catch (err: unknown) {
      failed++;
      // Mark invalid/expired tokens for cleanup
      const errorCode = (err as { code?: string })?.code;
      if (
        errorCode === "messaging/invalid-registration-token" ||
        errorCode === "messaging/registration-token-not-registered"
      ) {
        invalidTokens.push(tokenRow.token);
      } else {
        console.warn(
          `[PushNotifications] Failed to send to token ${tokenRow.token.slice(0, 20)}...:`,
          errorCode
        );
      }
    }
  }

  // Clean up invalid tokens
  if (invalidTokens.length > 0) {
    const db = await getDb();
    if (db) {
      for (const t of invalidTokens) {
        await removeDeviceToken(t);
      }
      console.info(
        `[PushNotifications] Removed ${invalidTokens.length} invalid token(s).`
      );
    }
  }

  return { sent, failed, fallback: false };
}
