// Service Worker for Zexpand PWA & Push Notifications
const CACHE_NAME = "zexpand-v1";
const ASSETS_TO_CACHE = ["/", "/index.html", "/favicon.svg", "/manifest.webmanifest"];

// Install Event
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Push Notification Listener (PWA Push Notifications)
let lastNotificationTime = 0;
const MIN_NOTIFICATION_INTERVAL_MS = 1000 * 60 * 5; // 5 minute throttling for background PWA pushes to prevent fatigue

self.addEventListener("push", (event) => {
  let data = { title: "Zexpand Update", body: "New activity recorded in your workspace." };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const now = Date.now();
  // If pushed in background, ensure clean non-fatiguing delivery
  const options = {
    body: data.body || "New update in Zexpand",
    icon: "/logo.jpg",
    badge: "/logo.jpg",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
    tag: data.id || "zexpand-notif",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Zexpand Notification", options)
  );
});

// Notification Click Handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
