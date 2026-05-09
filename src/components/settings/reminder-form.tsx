"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { reminderSettingsSchema, type ReminderSettingsValues } from "@/features/settings/schema";
import { fetchSettings, updateSettings } from "@/features/settings/api";
import { CalendarDays, CalendarClock, CalendarRange } from "lucide-react";
import { Toggle } from "./toggle";

/* ------------------------------------------------------------------ */
/*  Weekday button group (Mon-Sun, 1-7 mapped to types 0-6 where 0=Sun)*/
/* ------------------------------------------------------------------ */

const WEEKDAYS = [
  { label: "周一", value: 1 },
  { label: "周二", value: 2 },
  { label: "周三", value: 3 },
  { label: "周四", value: 4 },
  { label: "周五", value: 5 },
  { label: "周六", value: 6 },
  { label: "周日", value: 0 }
] as const;

function WeekdayGroup({
  value,
  onChange
}: {
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {WEEKDAYS.map((d) => (
        <button
          key={d.value}
          type="button"
          aria-pressed={value === d.value}
          onClick={() => onChange(d.value)}
          className={`h-7 min-w-[2rem] rounded-full px-2 text-xs transition-colors ${
            value === d.value
              ? "bg-[#a96f3d] text-[#f8fbff]"
              : "bg-[rgba(96,69,41,0.08)] text-[#604529] hover:bg-[rgba(96,69,41,0.15)]"
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main form                                                          */
/* ------------------------------------------------------------------ */

export function ReminderForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  const {
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors, isDirty }
  } = useForm<ReminderSettingsValues>({
    resolver: zodResolver(reminderSettingsSchema),
    defaultValues: {
      dailyReminder: { enabled: false, time: "09:00" },
      weeklyReminder: { enabled: false, day: 1, time: "10:00" },
      monthlyReview: { enabled: false, day: 1, time: "09:00" }
    }
  });

  const dailyEnabled = watch("dailyReminder.enabled");
  const weeklyEnabled = watch("weeklyReminder.enabled");
  const monthlyEnabled = watch("monthlyReview.enabled");

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await fetchSettings();
        reset({
          dailyReminder: {
            enabled: settings.reminder?.dailyReminder?.enabled ?? false,
            time: settings.reminder?.dailyReminder?.time ?? "09:00"
          },
          weeklyReminder: {
            enabled: settings.reminder?.weeklyReminder?.enabled ?? false,
            day: settings.reminder?.weeklyReminder?.day ?? 1,
            time: settings.reminder?.weeklyReminder?.time ?? "10:00"
          },
          monthlyReview: {
            enabled: settings.reminder?.monthlyReview?.enabled ?? false,
            day: settings.reminder?.monthlyReview?.day ?? 1,
            time: settings.reminder?.monthlyReview?.time ?? "09:00"
          }
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [reset]);

  const onSubmit = async (data: ReminderSettingsValues) => {
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      await updateSettings({ reminder: data });
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse bg-[rgba(115,77,39,0.06)]" />
        ))}
      </div>
    );
  }

  const inputClass =
    "w-full border-b border-[rgba(96,69,41,0.2)] bg-transparent px-0 py-2 text-sm text-[#302114] focus:border-[#a96f3d] focus:outline-none";
  const selectClass =
    "w-full appearance-none border-b border-[rgba(96,69,41,0.2)] bg-transparent px-0 py-2 text-sm text-[#302114] focus:border-[#a96f3d] focus:outline-none";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
      {/* ---- 每日提醒 ---- */}
      <div className="border-b border-[rgba(96,69,41,0.2)] py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 text-[#604529]" />
            <div>
              <p className="text-sm text-[#302114]">每日提醒</p>
              <p className="text-xs text-[#7a6857]">每天在指定时间收到提醒</p>
            </div>
          </div>
          <Controller
            name="dailyReminder.enabled"
            control={control}
            render={({ field }) => (
              <Toggle checked={field.value ?? false} onChange={field.onChange} />
            )}
          />
        </div>
        {dailyEnabled && (
          <div className="ml-6">
            <label className="mb-1 block text-xs text-[#604529]">提醒时间</label>
            <Controller
              name="dailyReminder.time"
              control={control}
              render={({ field }) => (
                <input
                  type="time"
                  className={inputClass}
                  value={field.value ?? "09:00"}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>
        )}
        {errors.dailyReminder && (
          <p className="text-xs text-[#7c5568]">
            {errors.dailyReminder.enabled?.message ?? errors.dailyReminder.time?.message}
          </p>
        )}
      </div>

      {/* ---- 每周提醒 ---- */}
      <div className="border-b border-[rgba(96,69,41,0.2)] py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarClock className="h-4 w-4 text-[#604529]" />
            <div>
              <p className="text-sm text-[#302114]">每周提醒</p>
              <p className="text-xs text-[#7a6857]">每周在指定日期和时间收到提醒</p>
            </div>
          </div>
          <Controller
            name="weeklyReminder.enabled"
            control={control}
            render={({ field }) => (
              <Toggle checked={field.value ?? false} onChange={field.onChange} />
            )}
          />
        </div>
        {weeklyEnabled && (
          <div className="ml-6 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs text-[#604529]">提醒日</label>
              <Controller
                name="weeklyReminder.day"
                control={control}
                render={({ field }) => (
                  <WeekdayGroup value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#604529]">提醒时间</label>
              <Controller
                name="weeklyReminder.time"
                control={control}
                render={({ field }) => (
                  <input
                    type="time"
                    className={inputClass}
                    value={field.value ?? "10:00"}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>
          </div>
        )}
        {errors.weeklyReminder && (
          <p className="text-xs text-[#7c5568]">
            {errors.weeklyReminder.enabled?.message ?? errors.weeklyReminder.day?.message ?? errors.weeklyReminder.time?.message}
          </p>
        )}
      </div>

      {/* ---- 月度回顾提醒 ---- */}
      <div className="border-b border-[rgba(96,69,41,0.2)] py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarRange className="h-4 w-4 text-[#604529]" />
            <div>
              <p className="text-sm text-[#302114]">月度回顾提醒</p>
              <p className="text-xs text-[#7a6857]">每月在指定日期提醒进行回顾</p>
            </div>
          </div>
          <Controller
            name="monthlyReview.enabled"
            control={control}
            render={({ field }) => (
              <Toggle checked={field.value ?? false} onChange={field.onChange} />
            )}
          />
        </div>
        {monthlyEnabled && (
          <div className="ml-6 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[#604529]">每月日期</label>
              <Controller
                name="monthlyReview.day"
                control={control}
                render={({ field }) => (
                  <select
                    className={selectClass}
                    value={field.value ?? 1}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    onBlur={field.onBlur}
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        每月 {d} 日
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#604529]">提醒时间</label>
              <Controller
                name="monthlyReview.time"
                control={control}
                render={({ field }) => (
                  <input
                    type="time"
                    className={inputClass}
                    value={field.value ?? "09:00"}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>
          </div>
        )}
        {errors.monthlyReview && (
          <p className="text-xs text-[#7c5568]">
            {errors.monthlyReview.enabled?.message ?? errors.monthlyReview.day?.message}
          </p>
        )}
      </div>

      {/* 保存按钮 */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={!isDirty || isSaving}
          className="rounded-full bg-[#604529] px-4 py-1.5 text-sm text-[#f8fbff] transition-colors hover:bg-[#4a3520] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "保存中" : "保存"}
        </button>

        {saveStatus === "success" && <span className="text-sm text-[#45644a]">已保存</span>}
        {saveStatus === "error" && <span className="text-sm text-[#7c5568]">保存失败</span>}
      </div>
    </form>
  );
}
