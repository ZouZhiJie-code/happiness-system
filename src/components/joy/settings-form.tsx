"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Divider } from "@/components/ui";
import {
  type SettingsFormValues,
  settingsFormSchema
} from "@/features/joy-interview/schema/joy-interview.schema";

export function SettingsForm() {
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      memoryEnabled: false,
      transcriptAutoFallbackEnabled: true
    }
  });

  const values = form.watch();

  return (
    <form className="grid gap-5">
      <label className="flex items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="font-mono text-[0.68rem] tracking-[0.24em] text-[var(--text-faint)]">记忆能力</span>
          <span className="mt-2 block text-lg text-ink">启用历史记忆</span>
          <span className="mt-2 block text-pretty text-sm leading-7 text-[var(--text-dim)]">
            允许系统在日志访谈中引用有限的历史记录，用来判断重复出现的人、关系或偏好。
          </span>
        </span>
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-ember" {...form.register("memoryEnabled")} />
      </label>

      <Divider />

      <label className="flex items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="font-mono text-[0.68rem] tracking-[0.24em] text-[var(--text-faint)]">回退机制</span>
          <span className="mt-2 block text-lg text-ink">转写失败自动回退</span>
          <span className="mt-2 block text-pretty text-sm leading-7 text-[var(--text-dim)]">
            语音转写失败时，提示用户立刻切换到文字输入，避免打断当前访谈节奏。
          </span>
        </span>
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-moss"
          {...form.register("transcriptAutoFallbackEnabled")}
        />
      </label>

      <Divider />

      <section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[var(--text-faint)]">配置摘要</p>
            <h3 className="mt-3 font-display text-2xl text-ink">当前配置摘要</h3>
          </div>
          <span className="wood-chip rounded-full px-4 py-2 text-xs tracking-[0.16em]">已选择</span>
        </div>
        <p className="mt-3 text-pretty text-sm leading-8 text-[var(--text-dim)]">
          你可以在开始前快速确认这次访谈会使用哪些能力，避免进入对话后再来回切换。
        </p>
        <div className="mt-4 grid gap-1.5 text-sm leading-7 text-[var(--text-dim)]">
          <p>记忆功能：{values.memoryEnabled ? "开启" : "关闭"}</p>
          <p>转写回退：{values.transcriptAutoFallbackEnabled ? "开启" : "关闭"}</p>
          <p>建议状态：确认后即可开始今天的日志访谈。</p>
        </div>
      </section>
    </form>
  );
}
