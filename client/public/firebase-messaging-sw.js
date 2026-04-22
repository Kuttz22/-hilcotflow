/**
 * Firebase Cloud Messaging Service Worker
 * Handles background push notifications for Hilcot TaskFlow Web Push.
 *
 * Firebase config is embedded directly (these are public-facing identifiers,
 * not secret keys — safe to include in client-side code).
 */

// Import Firebase compat scripts (required in Service Worker context)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase config — public identifiers, safe to embed
const firebaseConfig = {
  apiKey: "AIzaSyAjMBQDn7ZJn0Ie0OxEABWrnTvwog9vYxo",
  projectId: "hilcot-taskflow",
  messagingSenderId: "794485585780",
  appId: "1:794485585780:web:5efd09a6e4080e46971e21",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages (app is not in foreground / tab is not active)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'Hilcot TaskFlow';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new task reminder.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {},
    actions: [
      { action: 'view', title: 'View Task' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    tag: `task-${payload.data?.taskId || 'general'}`,
    renotify: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — deep-link to the task detail page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const taskId = event.notification.data?.taskId;
  const urlToOpen = taskId ? `/tasks/${taskId}` : '/dashboard';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(urlToOpen);
          return;
        }
      }
      // Open a new tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
