"use client";

import { useEffect, useState } from "react";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(normalized);

  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function PushNotificationSettings({
  vapidPublicKey,
}: {
  vapidPublicKey: string | null;
}) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState("default");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncSubscriptionState() {
      const browserSupportsPush =
        typeof window !== "undefined" &&
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;

      if (!browserSupportsPush || !vapidPublicKey) {
        if (!cancelled) {
          setSupported(browserSupportsPush);
          setEnabled(false);
          setPermission(
            typeof window !== "undefined" && "Notification" in window
              ? Notification.permission
              : "default",
          );
        }
        return;
      }

      const registration = await navigator.serviceWorker.register("/push-sw.js");
      const subscription = await registration.pushManager.getSubscription();

      if (!cancelled) {
        setSupported(true);
        setEnabled(Boolean(subscription));
        setPermission(Notification.permission);
      }
    }

    void syncSubscriptionState();

    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  async function enablePush() {
    if (!vapidPublicKey) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.register("/push-sw.js");
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        setMessage("Browser notifications are blocked for this site.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
      });

      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        throw new Error("Failed to store the push subscription");
      }

      setEnabled(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to enable browser push");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.register("/push-sw.js");
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });
        await subscription.unsubscribe();
      }

      setEnabled(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to disable browser push");
    } finally {
      setBusy(false);
    }
  }

  if (!vapidPublicKey) {
    return (
      <p className="text-sm leading-6 text-[var(--muted)]">
        Browser push is unavailable until `WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_PRIVATE_KEY` are configured.
      </p>
    );
  }

  if (!supported) {
    return (
      <p className="text-sm leading-6 text-[var(--muted)]">
        This browser does not support the Push API or service workers.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="panel-muted p-4">
        <p className="text-sm font-medium text-[var(--text)]">
          Current device: {enabled ? "Browser push enabled" : "Browser push disabled"}
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Permission: {permission}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {enabled ? (
          <button
            className="ghost-button"
            disabled={busy}
            onClick={() => void disablePush()}
            type="button"
          >
            Disable browser push
          </button>
        ) : (
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void enablePush()}
            type="button"
          >
            Enable browser push
          </button>
        )}
      </div>

      {message ? <p className="text-sm leading-6 text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
