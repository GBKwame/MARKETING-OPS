import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Register PWA Service Worker & Push Notifications
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("📱 PWA Service Worker registered successfully:", reg.scope);
      })
      .catch((err) => {
        console.error("❌ PWA Service Worker registration failed:", err);
      });
  });
}

// Request Notification Permission for Web & PWA
if ("Notification" in window && Notification.permission === "default") {
  window.addEventListener("click", function requestNotifPerm() {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        console.log("🔔 Browser & PWA Notification permission granted!");
      }
    });
    window.removeEventListener("click", requestNotifPerm);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
