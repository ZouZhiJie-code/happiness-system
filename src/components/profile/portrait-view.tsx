"use client";

import React from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import type { InterviewDimension } from "@prisma/client";

import type { PortraitSnapshotView, PortraitApiResponse } from "@/features/portrait/types";
import { DIMENSION_META, DIMENSION_ORDER } from "@/features/portrait/types";
import type { GroupedProfile } from "@/features/portrait/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSnapshotStale(snapshot: PortraitSnapshotView, profileData: GroupedProfile) {
  const facts = Object.values(profileData).flat();
  if (facts.length !== snapshot.factCount) {
    return true;
  }

  const snapshotGeneratedAt = new Date(snapshot.generatedAt).getTime();
  return facts.some((fact) => new Date(fact.updatedAt).getTime() > snapshotGeneratedAt);
}

export function PortraitView({ onOpenMemories }: { onOpenMemories?: () => void }) {
  const [snapshot, setSnapshot] = useState<PortraitSnapshotView | null>(null);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [expandedDim, setExpandedDim] = useState<InterviewDimension | null>(null);
  const [factCount, setFactCount] = useState(0);
  const [memoryEnabled, setMemoryEnabled] = useState(false);

  const fetchPortrait = useCallback(async () => {
    try {
      setLoading(true);
      const [portraitRes, profileRes, settingsRes] = await Promise.all([
        fetch("/api/profile/portrait"),
        fetch("/api/profile"),
        fetch("/api/settings")
      ]);
      if (!portraitRes.ok) throw new Error("fetch failed");
      const json: PortraitApiResponse = await portraitRes.json();
      setSnapshot(json.snapshot);
      setError(null);

      // Check if snapshot is stale
      if (profileRes.ok) {
        const profileData = (await profileRes.json()) as GroupedProfile;
        const nextFactCount = Object.values(profileData).flat().length;
        setFactCount(nextFactCount);
        setStale(json.snapshot ? isSnapshotStale(json.snapshot, profileData) : false);
      } else {
        setStale(false);
      }
      if (settingsRes.ok) {
        const settings = (await settingsRes.json()) as { memoryEnabled: boolean };
        setMemoryEnabled(settings.memoryEnabled);
      }
    } catch {
      setError("加载画像失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPortrait();
  }, [fetchPortrait]);

  async function handleSynthesize() {
    if (factCount < 3) {
      setHint(`还需要 ${3 - factCount} 条认知，补充后即可生成画像。`);
      return;
    }

    try {
      setSynthesizing(true);
      setError(null);
      setHint(null);
      const res = await fetch("/api/profile/portrait", { method: "POST" });
      if (res.status === 422) {
        setHint("认知数据不足。请先通过访谈或手动添加至少 3 条认知，再生成画像。");
        return;
      }
      if (!res.ok) {
        throw new Error("生成失败");
      }
      await fetchPortrait();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成画像失败");
    } finally {
      setSynthesizing(false);
    }
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded bg-[rgba(255,249,239,0.5)]" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  if (error && !snapshot) {
    return (
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-6">
        <p className="text-sm text-[#a07060]">{error}</p>
        <button
          type="button"
          className="mt-3 wood-chip rounded-full px-4 py-1.5 text-xs tracking-[0.1em]"
          onClick={fetchPortrait}
        >
          重试
        </button>
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────────────

  if (!snapshot) {
    const missingFactCount = Math.max(0, 3 - factCount);

    return (
      <div className="space-y-4">
        {/* Summary empty state */}
        <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(239,224,194,0.52)] p-6">
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">
            关于你
          </p>
          <p className="mt-4 text-sm leading-7 text-[#5a4632]">
            生成日志时会逐步积累认知；达到 3 条后，你可以主动生成一份关于自己的总结。
          </p>
          {!memoryEnabled ? (
            <p className="mt-3 text-xs leading-6 text-[#8a7a68]">
              历史记忆当前关闭。开启后，新的日志可以继续积累长期认知。
              <Link href="/settings" className="ml-1 underline underline-offset-4">前往设置</Link>
            </p>
          ) : null}
          <div className="mt-4">
            <button
              type="button"
              className="wood-chip rounded-full px-4 py-1.5 text-xs tracking-[0.1em]"
              onClick={handleSynthesize}
              disabled={synthesizing || factCount < 3}
            >
              {synthesizing ? "生成中…" : "生成画像"}
            </button>
            {missingFactCount > 0 ? (
              <p className="mt-3 text-xs leading-6 text-[#8a7a68]">还需要 {missingFactCount} 条认知。</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <Link href="/interview" className="underline underline-offset-4">开始记录</Link>
              <button type="button" onClick={onOpenMemories} className="underline underline-offset-4">添加认知</button>
            </div>
            {hint && (
              <p className="mt-3 text-xs leading-6 text-[#8a7a68]">{hint}</p>
            )}
            {error && (
              <p className="mt-3 text-xs text-[#a07060]">{error}</p>
            )}
          </div>
        </div>

        {/* Dimension placeholders */}
        {DIMENSION_ORDER.map((dim) => (
          <div
            key={dim}
            className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.28)] p-4"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-full border border-[rgba(168,124,69,0.22)] bg-[rgba(191,133,73,0.1)] font-mono text-xs text-[#6a4f33]">
                {DIMENSION_META[dim].label}
              </span>
              <span className="text-sm font-medium text-[#2f2217]">
                {DIMENSION_META[dim].full}
              </span>
            </div>
            <p className="mt-3 text-xs text-[#8a7a68]">生成画像后将显示洞察</p>
          </div>
        ))}
      </div>
    );
  }

  // ─── Portrait with snapshot ───────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Summary section */}
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(239,224,194,0.52)] p-6">
        <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">
          关于你
        </p>
        <p className="mt-3 text-base leading-8 text-[#2c2117] font-display">
          {snapshot.summary}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-[0.68rem] tracking-[0.24em] text-[#8a7a68]">
            基于 {snapshot.factCount} 条画像 · {formatDate(snapshot.generatedAt)}
          </span>
          <button
            type="button"
            className="rounded-full border border-[rgba(115,77,39,0.14)] px-3 py-1 text-[0.65rem] tracking-[0.1em] text-[#6a5e53] transition-colors hover:bg-[rgba(255,249,239,0.5)]"
            onClick={handleSynthesize}
            disabled={synthesizing}
          >
            {synthesizing ? "生成中…" : "重新生成"}
          </button>
        </div>
        {stale && (
          <p className="mt-3 text-xs text-[#8a7a68]">
            认知数据已更新，建议重新生成画像以反映最新变化。
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-[#a07060]">{error}</p>
      )}

      {/* Dimension cards */}
      {DIMENSION_ORDER.map((dim) => {
        const insight = snapshot.dimensionInsights[dim] ?? "暂无洞察";
        const meta = DIMENSION_META[dim];
        const isExpanded = expandedDim === dim;

        return (
          <div
            key={dim}
            className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.28)] p-4"
          >
            <button
              type="button"
              aria-expanded={isExpanded}
              className="flex w-full items-center justify-between text-left"
              onClick={() => setExpandedDim(isExpanded ? null : dim)}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-full border border-[rgba(168,124,69,0.22)] bg-[rgba(191,133,73,0.1)] font-mono text-xs text-[#6a4f33]">
                  {meta.label}
                </span>
                <span className="text-sm font-medium text-[#2f2217]">
                  {meta.full}
                </span>
              </div>
              <span
                className={`text-xs text-[#8a7a68] transition-transform ${isExpanded ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            </button>

            {!isExpanded ? (
              <p className="mt-2 truncate text-xs leading-6 text-[#6a5e53]">
                {insight}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-7 text-[#2c2117]">
                {insight}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
