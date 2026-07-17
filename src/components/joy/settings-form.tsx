"use client";

import React, { useEffect, useState } from "react";

import { Divider } from "@/components/ui";

export function SettingsForm() {
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [state, setState] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("SETTINGS_QUERY_FAILED");
        return (await response.json()) as { memoryEnabled: boolean };
      })
      .then((settings) => {
        if (cancelled) return;
        setMemoryEnabled(settings.memoryEnabled);
        setState("idle");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleMemoryChange(nextValue: boolean) {
    const previousValue = memoryEnabled;
    setMemoryEnabled(nextValue);
    setState("saving");

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryEnabled: nextValue })
      });
      if (!response.ok) throw new Error("SETTINGS_UPDATE_FAILED");
      setState("saved");
    } catch {
      setMemoryEnabled(previousValue);
      setState("error");
    }
  }

  return (
    <section className="grid gap-5" aria-busy={state === "loading" || state === "saving"}>
      <label className="flex items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="font-mono text-[0.68rem] tracking-[0.24em] text-[var(--text-faint)]">记忆能力</span>
          <span className="mt-2 block text-lg text-ink">启用历史记忆</span>
          <span className="mt-2 block text-pretty text-sm leading-7 text-[var(--text-dim)]">
            允许系统在日志访谈中引用有限的历史记录，用来判断重复出现的人、关系或偏好。
          </span>
        </span>
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-ember"
          checked={memoryEnabled}
          disabled={state === "loading" || state === "saving"}
          onChange={(event) => void handleMemoryChange(event.target.checked)}
        />
      </label>

      <Divider />
      <p role={state === "error" ? "alert" : "status"} className={`text-sm ${state === "error" ? "text-[#8a5440]" : "text-[var(--text-faint)]"}`}>
        {state === "loading"
          ? "正在读取设置…"
          : state === "saving"
            ? "正在保存…"
            : state === "saved"
              ? "设置已保存"
              : state === "error"
                ? "设置保存失败，请重试。"
                : memoryEnabled
                  ? "历史记忆已开启"
                  : "历史记忆当前关闭"}
      </p>
    </section>
  );
}
