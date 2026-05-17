"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

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
    <form className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] md:p-5">
      <div>
        <div className="grid gap-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="flex items-start justify-between gap-4 border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.44)] px-4 py-4">
              <span className="relative z-10">
                <span className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">记忆能力</span>
                <span className="mt-2 block text-lg text-[#2f2217]">启用历史记忆</span>
                <span className="mt-2 block text-pretty text-sm leading-7 text-[#5a4632]">
                  允许系统在日志访谈中引用有限的历史记录，用来判断重复出现的人、关系或偏好。
                </span>
              </span>
              <input type="checkbox" className="mt-1 size-5 accent-[#d89d59]" {...form.register("memoryEnabled")} />
            </label>

            <label className="flex items-start justify-between gap-4 border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.44)] px-4 py-4">
              <span className="relative z-10">
                <span className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">回退机制</span>
                <span className="mt-2 block text-lg text-[#2f2217]">转写失败自动回退</span>
                <span className="mt-2 block text-pretty text-sm leading-7 text-[#5a4632]">
                  语音转写失败时，提示用户立刻切换到文字输入，避免打断当前访谈节奏。
                </span>
              </span>
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[#8ba17a]"
                {...form.register("transcriptAutoFallbackEnabled")}
              />
            </label>
          </div>

          <aside className="border border-[rgba(115,77,39,0.14)] bg-[rgba(239,224,194,0.52)] p-4 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">配置摘要</p>
                <h3 className="mt-3 font-display text-2xl text-[#231d17]">当前配置摘要</h3>
              </div>
              <span className="wood-chip rounded-full px-4 py-2 text-xs tracking-[0.16em]">已选择</span>
            </div>
            <p className="mt-3 text-pretty text-sm leading-8 text-[#524436]">
              你可以在开始前快速确认这次访谈会使用哪些能力，避免进入对话后再来回切换。
            </p>
            <div className="mt-5 grid gap-3 text-sm leading-7 text-[#473b2f] md:grid-cols-3">
              <p className="wood-chip px-4 py-3">记忆功能：{values.memoryEnabled ? "开启" : "关闭"}</p>
              <p className="wood-chip px-4 py-3">
                转写回退：{values.transcriptAutoFallbackEnabled ? "开启" : "关闭"}
              </p>
              <p className="wood-chip px-4 py-3">建议状态：确认后即可开始今天的日志访谈。</p>
            </div>
          </aside>
        </div>
      </div>
    </form>
  );
}
