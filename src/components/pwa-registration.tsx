"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (window.location.protocol !== "https:" && window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") {
      return;
    }

    void navigator.serviceWorker.register("/push-sw.js", { scope: "/" }).catch((error) => {
      console.warn("Freshwax service worker registration failed", error);
    });
  }, []);

  return null;
}
