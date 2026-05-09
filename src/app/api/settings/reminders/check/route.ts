import { NextResponse } from "next/server";
import { getUserSettings } from "@/server/repositories/settings.repository";
import type { ReminderSettings } from "@/features/settings/types";

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

interface ReminderNotification {
  type: string;
  title: string;
  body: string;
  link: string;
  dismissKey: string;
}

function parseHHMM(time: string): [number, number] | null {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

function getShanghaiDateParts(now: Date) {
  const sh = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  const y = sh.getUTCFullYear();
  const m = String(sh.getUTCMonth() + 1).padStart(2, "0");
  const d = String(sh.getUTCDate()).padStart(2, "0");
  return {
    dateStr: `${y}-${m}-${d}`,
    hours: sh.getUTCHours(),
    minutes: sh.getUTCMinutes(),
    jsDay: sh.getUTCDay(), // 0=Sun
    monthDay: sh.getUTCDate(),
  };
}

export async function GET() {
  try {
    const settings = await getUserSettings();
    const reminder = (settings?.reminder ?? {}) as ReminderSettings;

    const { dateStr, hours, minutes, jsDay, monthDay } = getShanghaiDateParts(new Date());
    const nowMinutes = hours * 60 + minutes;

    const due: ReminderNotification[] = [];

    // Daily
    if (reminder.dailyReminder?.enabled && reminder.dailyReminder.time) {
      const parsed = parseHHMM(reminder.dailyReminder.time);
      if (parsed && nowMinutes >= parsed[0] * 60 + parsed[1]) {
        due.push({
          type: "daily",
          title: "该记录今天的心情了",
          body: "花几分钟，和自己聊聊今天。",
          link: "/interview?dimension=joy",
          dismissKey: `daily|${dateStr}`,
        });
      }
    }

    // Weekly
    if (
      reminder.weeklyReminder?.enabled &&
      reminder.weeklyReminder.time &&
      reminder.weeklyReminder.day !== undefined
    ) {
      const parsed = parseHHMM(reminder.weeklyReminder.time);
      if (parsed && reminder.weeklyReminder.day === jsDay && nowMinutes >= parsed[0] * 60 + parsed[1]) {
        due.push({
          type: "weekly",
          title: "本周回顾时间",
          body: "看看这一周有哪些值得记住的瞬间。",
          link: "/analysis",
          dismissKey: `weekly|${dateStr}`,
        });
      }
    }

    // Monthly
    if (
      reminder.monthlyReview?.enabled &&
      reminder.monthlyReview.time &&
      reminder.monthlyReview.day !== undefined
    ) {
      const parsed = parseHHMM(reminder.monthlyReview.time);
      if (parsed && reminder.monthlyReview.day === monthDay && nowMinutes >= parsed[0] * 60 + parsed[1]) {
        due.push({
          type: "monthly",
          title: "月度回顾就绪",
          body: "上个月的记录已准备好，看看你的变化轨迹。",
          link: "/analysis",
          dismissKey: `monthly|${dateStr}`,
        });
      }
    }

    return NextResponse.json(due);
  } catch (error) {
    console.error("[reminders/check]", error);
    return NextResponse.json({ error: "REMINDER_CHECK_FAILED" }, { status: 500 });
  }
}
