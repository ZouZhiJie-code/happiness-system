"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { notificationSettingsSchema, type NotificationSettingsValues } from "@/features/settings/schema";
import { fetchSettings, updateSettings } from "@/features/settings/api";
import { Mail, Bell } from "lucide-react";
import { Toggle } from "./toggle";

export function NotificationForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  const {
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty }
  } = useForm<NotificationSettingsValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      emailEnabled: false,
      systemEnabled: false
    }
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await fetchSettings();
        reset({
          emailEnabled: settings.notification?.emailEnabled ?? false,
          systemEnabled: settings.notification?.systemEnabled ?? false
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [reset]);

  const onSubmit = async (data: NotificationSettingsValues) => {
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      await updateSettings({ notification: data });
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
        {[1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse bg-[rgba(115,77,39,0.06)]" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
      {/* 邮件提醒 */}
      <div className="flex items-center justify-between border-b border-[rgba(96,69,41,0.2)] py-3">
        <div className="flex items-center gap-2.5">
          <Mail className="h-4 w-4 text-[#604529]" />
          <div>
            <p className="text-sm text-[#302114]">邮件提醒</p>
            <p className="text-xs text-[#7a6857]">接收重要更新的邮件通知</p>
          </div>
        </div>
        <Controller
          name="emailEnabled"
          control={control}
          render={({ field }) => (
            <Toggle checked={field.value ?? false} onChange={field.onChange} />
          )}
        />
      </div>
      {errors.emailEnabled && <p className="py-1 text-xs text-[#7c5568]">{errors.emailEnabled.message}</p>}

      {/* 系统通知 */}
      <div className="flex items-center justify-between border-b border-[rgba(96,69,41,0.2)] py-3">
        <div className="flex items-center gap-2.5">
          <Bell className="h-4 w-4 text-[#604529]" />
          <div>
            <p className="text-sm text-[#302114]">系统通知</p>
            <p className="text-xs text-[#7a6857]">在应用内接收通知提醒</p>
          </div>
        </div>
        <Controller
          name="systemEnabled"
          control={control}
          render={({ field }) => (
            <Toggle checked={field.value ?? false} onChange={field.onChange} />
          )}
        />
      </div>
      {errors.systemEnabled && <p className="py-1 text-xs text-[#7c5568]">{errors.systemEnabled.message}</p>}

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
