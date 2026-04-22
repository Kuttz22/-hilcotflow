/**
 * Firebase Cloud Messaging — Frontend Web Push Integration
 *
 * Provides:
 *  - requestNotificationPermission(): asks the browser for push permission
 *  - getFCMToken(): gets the FCM registration token for this browser
 *  - onForegroundMessage(): registers a handler for foreground push messages
 *
 * The token is then sent to the backend via trpc.notifications.registerDevice
 * so the scheduler can deliver real push notifications to this browser.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

function getFirebaseApp() {
  if (getApps().length > 0) return getApp();
  return initializeApp(firebaseConfig);
}

let messagingInstance: Messaging | null = null;

function getMessagingInstance(): Messaging | null {
  if (messagingInstance) return messagingInstance;

  // Check if all required config values are present
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    !firebaseConfig.messagingSenderId ||
    !firebaseConfig.appId
  ) {
    console.warn("[FCM] Firebase config incomplete — push notifications disabled.");
    return null;
  }

  try {
    const app = getFirebaseApp();
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.warn("[FCM] Failed to initialize Firebase Messaging:", err);
    return null;
  }
}

/**
 * Request browser notification permission.
 * Returns 'granted', 'denied', or 'default'.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    console.warn("[FCM] Notifications not supported in this browser.");
    return "denied";
  }

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Get the FCM registration token for this browser.
 * Requires notification permission to be granted first.
 * Returns null if Firebase is not configured or permission is denied.
 */
export async function getFCMToken(): Promise<string | null> {
  const messaging = getMessagingInstance();
  if (!messaging) return null;

  if (!VAPID_KEY) {
    console.warn("[FCM] VITE_FIREBASE_VAPID_KEY not set — cannot get FCM token.");
    return null;
  }

  try {
    // Register the service worker first
    const swRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      console.info("[FCM] Registration token obtained:", token.substring(0, 20) + "...");
      return token;
    } else {
      console.warn("[FCM] No registration token available.");
      return null;
    }
  } catch (err) {
    console.error("[FCM] Failed to get registration token:", err);
    return null;
  }
}

/**
 * Register a handler for foreground push messages (app is in focus).
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(
  handler: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void
): () => void {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};

  return onMessage(messaging, handler);
}
