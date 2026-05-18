"use client";

import React from "react";
import { useCallback, useEffect, useState } from "react";

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

export function PortraitView() {
  const [snapshot, setSnapshot] = useState<PortraitSnapshotView | null>(null);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [expandedDim, setExpandedDim] = useState<InterviewDimension | null>(null);

  const fetchPortrait = useCallback(async () => {
    try {
      setLoading(true);
      const [portraitRes, profileRes] = await Promise.all([
        fetch("/api/profile/portrait"),
        fetch("/api/profile")
      ]);
      if (!portraitRes.ok) throw new Error("fetch failed");
      const json: PortraitApiResponse = await portraitRes.json();
      setSnapshot(json.snapshot);
      setError(null);

      // Check if snapshot is stale
      if (json.snapshot && profileRes.ok) {
        const profileData = (await profileRes.json()) as GroupedProfile;
        setStale(isSnapshotStale(json.snapshot, profileData));
      } else {
        setStale(false);
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
    return (
      <div className="space-y-4">
        {/* Summary empty state */}
        <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(239,224,194,0.52)] p-6">
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">
            关于你
          </p>
          <p className="mt-4 text-sm leading-7 text-[#5a4632]">
            还没有生成画像。完成访谈后，系统会根据你的回答自动生成一份关于你的总结。
          </p>
          <div className="mt-4">
            <button
              type="button"
              className="wood-chip rounded-full px-4 py-1.5 text-xs tracking-[0.1em]"
              onClick={handleSynthesize}
              disabled={synthesizing}
            >
              {synthesizing ? "生成中…" : "生成画像"}
            </button>
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
