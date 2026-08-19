// Service Worker for MarketOps PWA & Push Notifications
const CACHE_NAME = "marketops-v1";
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
  let data = { title: "MarketOps Update", body: "New activity recorded in your workspace." };
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
    body: data.body || "New update in MarketOps",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
    tag: data.id || "marketops-notif",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "MarketOps Notification", options)
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
