// Utility for Mobile PWA Web Push Notifications

// Convert URL-safe base64 string to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Public VAPID Key for Web Push (default dev key)
const PUBLIC_VAPID_KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-NjvOiWf50_L4_sO8_a6V009J-p5kM6gH3_M0L5q5O-K-O5V509J-p5k";

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    console.warn("Notifications are not supported in this browser environment.");
    return "denied";
  }

  const permission = await Notification.requestPermission();
  return permission;
}

export async function subscribeUserToPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Service Worker or Push Messaging is not supported.");
    return false;
  }

  try {
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      try {
        const convertedKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      } catch (subErr) {
        console.warn("Standard VAPID subscription fallback:", subErr);
        // Fallback for browsers that accept simple subscription without server key
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
        });
      }
    }

    if (subscription) {
      // Send subscription object to backend server
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      return true;
    }
  } catch (err) {
    console.error("Error subscribing user to push notifications:", err);
  }

  return false;
}

export async function sendTestNotification(): Promise<boolean> {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification("Zexpand Mobile PWA", {
          body: "🔔 Mobile Push Notifications active! You will receive top screen alerts for activities, approvals, and leads.",
          icon: "/favicon.png",
          badge: "/favicon.png",
          vibrate: [100, 50, 100],
          tag: "zexpand-test-push",
          renotify: true,
          data: { url: "/" },
        } as NotificationOptions);
        return true;
      }
    }

    if (Notification.permission === "granted") {
      new Notification("Zexpand Mobile PWA", {
        body: "🔔 Mobile Push Notifications active! You will receive top screen alerts.",
        icon: "/favicon.png",
      });
      return true;
    }
  } catch (e) {
    console.error("Failed to show test notification:", e);
  }
  return false;
}
