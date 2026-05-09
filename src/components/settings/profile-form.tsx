"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileFormSchema, type ProfileFormValues } from "@/features/settings/schema";
import { fetchSettings, updateSettings } from "@/features/settings/api";

export function ProfileForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      nickname: null,
      bio: null
    }
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await fetchSettings();
        reset({
          nickname: settings.nickname,
          bio: settings.bio
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [reset]);

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      await updateSettings(data);
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 昵称 */}
      <div className="space-y-1.5">
        <label htmlFor="nickname" className="block text-sm text-[#604529]">
          昵称
        </label>
        <input
          id="nickname"
          type="text"
          placeholder="输入你的昵称"
          className="w-full border-b border-[rgba(96,69,41,0.2)] bg-transparent px-0 py-2 text-[#302114] placeholder-[#7a6857] focus:border-[#a96f3d] focus:outline-none"
          {...register("nickname")}
        />
        {errors.nickname && <p className="text-xs text-[#7c5568]">{errors.nickname.message}</p>}
      </div>

      {/* 个人简介 */}
      <div className="space-y-1.5">
        <label htmlFor="bio" className="block text-sm text-[#604529]">
          个人简介
        </label>
        <textarea
          id="bio"
          rows={4}
          placeholder="简单介绍一下自己..."
          className="w-full resize-none border-b border-[rgba(96,69,41,0.2)] bg-transparent px-0 py-2 text-[#302114] placeholder-[#7a6857] focus:border-[#a96f3d] focus:outline-none"
          {...register("bio")}
        />
        {errors.bio && <p className="text-xs text-[#7c5568]">{errors.bio.message}</p>}
      </div>

      {/* 保存按钮 */}
      <div className="flex items-center gap-3 pt-2">
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
