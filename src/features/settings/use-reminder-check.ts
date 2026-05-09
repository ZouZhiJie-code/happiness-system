"use client";

import { useCallback, useEffect, useState } from "react";

export interface DueReminder {
  type: string;
  title: string;
  body: string;
  link: string;
  dismissKey: string;
}

const STORAGE_PREFIX = "reminder-dismissed:";

function isDismissed(dismissKey: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${dismissKey}`) === "1";
  } catch {
    return false;
  }
}

function markDismissed(dismissKey: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${dismissKey}`, "1");
  } catch {
    // silent
  }
}

function fireSystemNotification(reminder: DueReminder): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  try {
    const notification = new Notification(reminder.title, { body: reminder.body });
    notification.onclick = () => {
      window.focus();
      window.location.href = reminder.link;
      notification.close();
    };
  } catch {
    // silent – service worker context may not support constructor directly
  }
}

export function useReminderCheck(): {
  reminders: DueReminder[];
  dismiss: (key: string) => void;
} {
  const [reminders, setReminders] = useState<DueReminder[]>([]);

  // Clean up ALL legacy reminder keys (fired + dismissed) from previous implementations
  useEffect(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("reminder-fired:") || k.startsWith("reminder-dismissed:"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // Request notification permission and wait for result
      let hasPermission = false;
      try {
        if (typeof Notification !== "undefined") {
          if (Notification.permission === "granted") {
            hasPermission = true;
          } else if (Notification.permission === "default") {
            const perm = await Notification.requestPermission();
            hasPermission = perm === "granted";
          }
        }
      } catch (e) {
        console.warn("[reminder] permission error:", e);
      }

      console.log("[reminder] 1. hasPermission:", hasPermission, "Notification API available:", typeof Notification !== "undefined");

      try {
        const res = await fetch("/api/settings/reminders/check");
        console.log("[reminder] 2. API response status:", res.status);
        if (!res.ok || cancelled) return;
        const due: DueReminder[] = await res.json();
        if (cancelled) return;

        console.log("[reminder] 3. due from API:", JSON.stringify(due));

        const dismissedKeys = due.map(r => ({ key: r.dismissKey, dismissed: isDismissed(r.dismissKey) }));
        console.log("[reminder] 4. dismiss check:", JSON.stringify(dismissedKeys));

        // TODO: restore dismiss filter after debugging
        // const unseen = due.filter((r) => !isDismissed(r.dismissKey));
        const unseen = due;
        console.log("[reminder] 5. unseen reminders:", unseen.length);

        // Fire system notification for each due reminder
        if (hasPermission && unseen.length > 0) {
          for (const r of unseen) {
            console.log("[reminder] 6. firing:", r.title);
            fireSystemNotification(r);
          }
        }

        console.log("[reminder] 7. setting reminders state:", unseen.length);
        setReminders(unseen);
      } catch (err) {
        console.error("[reminder] fetch error:", err);
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback((dismissKey: string) => {
    markDismissed(dismissKey);
    setReminders((prev) => prev.filter((r) => r.dismissKey !== dismissKey));
  }, []);

  return { reminders, dismiss };
}
