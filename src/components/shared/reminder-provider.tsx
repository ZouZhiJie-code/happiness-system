"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { useReminderCheck } from "@/features/settings/use-reminder-check";

export function ReminderProvider() {
  const { reminders, dismiss } = useReminderCheck();
  console.log("[ReminderProvider] rendering, reminders:", reminders.length, reminders);

  if (reminders.length === 0) return null;

  const current = reminders[0];

  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 99999, background: "#f5ecdb", border: "2px solid #a96f3d", borderRadius: 12, padding: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", maxWidth: 360 }}>
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#a96f3d]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#302114]">{current.title}</p>
          <p className="mt-0.5 text-xs text-[#604529]/80">{current.body}</p>
          <div className="mt-2 flex items-center gap-3">
            <Link
              href={current.link}
              onClick={() => dismiss(current.dismissKey)}
              className="rounded-full bg-[#604529] px-3 py-1 text-sm text-[#f8fbff]"
            >
              去看看
            </Link>
            <button
              type="button"
              onClick={() => dismiss(current.dismissKey)}
              className="text-sm text-[#604529]"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
