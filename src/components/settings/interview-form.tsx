"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { interviewSettingsSchema, type InterviewSettingsValues } from "@/features/settings/schema";
import { fetchSettings, updateSettings } from "@/features/settings/api";
import { Brain, RotateCcw, MessageCircle, HelpCircle } from "lucide-react";

const DEPTH_OPTIONS: { value: "gentle" | "moderate" | "deep"; label: string; description: string }[] = [
  { value: "gentle", label: "温和", description: "轻轻触碰，不施加压力" },
  { value: "moderate", label: "适中", description: "适度追问，平衡深度与舒适" },
  { value: "deep", label: "深入", description: "层层递进，探索深层感受" }
];

export function InterviewForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty }
  } = useForm<InterviewSettingsValues>({
    resolver: zodResolver(interviewSettingsSchema),
    defaultValues: {
      memoryEnabled: true,
      transcriptAutoFallbackEnabled: true,
      inquiryDepth: "moderate",
      guideEnabled: true
    }
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await fetchSettings();
        reset({
          memoryEnabled: settings.memoryEnabled,
          transcriptAutoFallbackEnabled: settings.transcriptAutoFallbackEnabled,
          inquiryDepth: settings.interview?.inquiryDepth ?? "moderate",
          guideEnabled: settings.interview?.guideEnabled ?? true
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [reset]);

  const onSubmit = async (data: InterviewSettingsValues) => {
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      await updateSettings({
        memoryEnabled: data.memoryEnabled,
        transcriptAutoFallbackEnabled: data.transcriptAutoFallbackEnabled,
        interview: {
          inquiryDepth: data.inquiryDepth,
          guideEnabled: data.guideEnabled
        }
      });
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
      <div className="space-y-6" role="status" aria-label="加载中">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse bg-[rgba(115,77,39,0.06)]" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 记忆能力 */}
      <div className="flex items-center justify-between border-b border-[rgba(96,69,41,0.2)] py-3">
        <div className="flex items-center gap-2.5">
          <Brain size={16} className="text-[#604529]" />
          <div>
            <p className="text-sm text-[#302114]">记忆能力</p>
            <p className="text-xs text-[#7a6857]">访谈时自动引用过往日记中的相关内容</p>
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            {...register("memoryEnabled")}
          />
          <div className="h-5 w-9 rounded-full bg-[rgba(96,69,41,0.2)] transition-colors peer-checked:bg-[#a96f3d] peer-focus:ring-2 peer-focus:ring-[#a96f3d]/30 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4" />
        </label>
      </div>

      {/* 转写失败自动回退 */}
      <div className="flex items-center justify-between border-b border-[rgba(96,69,41,0.2)] py-3">
        <div className="flex items-center gap-2.5">
          <RotateCcw size={16} className="text-[#604529]" />
          <div>
            <p className="text-sm text-[#302114]">转写失败自动回退</p>
            <p className="text-xs text-[#7a6857]">语音识别失败时自动切换为文字输入</p>
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            {...register("transcriptAutoFallbackEnabled")}
          />
          <div className="h-5 w-9 rounded-full bg-[rgba(96,69,41,0.2)] transition-colors peer-checked:bg-[#a96f3d] peer-focus:ring-2 peer-focus:ring-[#a96f3d]/30 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4" />
        </label>
      </div>

      {/* 追问深度 */}
      <div className="border-b border-[rgba(96,69,41,0.2)] pb-4 pt-1">
        <div className="mb-3 flex items-center gap-2.5">
          <HelpCircle size={16} className="text-[#604529]" />
          <div>
            <p className="text-sm text-[#302114]">追问深度</p>
            <p className="text-xs text-[#7a6857]">AI 访谈时追问和探索的程度</p>
          </div>
        </div>
        <Controller
          control={control}
          name="inquiryDepth"
          render={({ field }) => (
            <>
              <div className="flex gap-2" role="radiogroup" aria-label="追问深度">
                {DEPTH_OPTIONS.map((option) => {
                  const isActive = field.value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => field.onChange(option.value)}
                      className={`flex-1 rounded-full border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[#a96f3d] focus-visible:outline-offset-2 ${
                        isActive
                          ? "border-[#a96f3d] bg-[#a96f3d] text-[#f8fbff]"
                          : "border-[rgba(96,69,41,0.2)] bg-transparent text-[#604529] hover:border-[#a96f3d]/50"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {field.value && (
                <p className="mt-2 text-xs text-[#7a6857]">
                  {DEPTH_OPTIONS.find((o) => o.value === field.value)?.description}
                </p>
              )}
            </>
          )}
        />
        {errors.inquiryDepth && <p className="mt-1 text-xs text-[#7c5568]">{errors.inquiryDepth.message}</p>}
      </div>

      {/* 引导语 */}
      <div className="flex items-center justify-between border-b border-[rgba(96,69,41,0.2)] py-3">
        <div className="flex items-center gap-2.5">
          <MessageCircle size={16} className="text-[#604529]" />
          <div>
            <p className="text-sm text-[#302114]">引导语</p>
            <p className="text-xs text-[#7a6857]">访谈开始时显示温馨引导，帮助进入状态</p>
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            {...register("guideEnabled")}
          />
          <div className="h-5 w-9 rounded-full bg-[rgba(96,69,41,0.2)] transition-colors peer-checked:bg-[#a96f3d] peer-focus:ring-2 peer-focus:ring-[#a96f3d]/30 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4" />
        </label>
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
