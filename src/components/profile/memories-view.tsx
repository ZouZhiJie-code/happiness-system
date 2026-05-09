"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { InterviewDimension, MemoryFact } from "@prisma/client";

import { MemoryCard } from "@/components/profile/memory-card";
import { AddMemoryDialog } from "@/components/profile/add-memory-dialog";
import { DIMENSION_META, DIMENSION_ORDER } from "@/features/portrait/types";

type GroupedProfile = Record<InterviewDimension, MemoryFact[]>;

const EMPTY_GROUPED: GroupedProfile = {
  joy: [],
  fulfillment: [],
  reflection: [],
  improvement: [],
  gratitude: []
};

export function MemoriesView() {
  const [data, setData] = useState<GroupedProfile>(EMPTY_GROUPED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [addDialog, setAddDialog] = useState<InterviewDimension | null>(null);
  const [collapsedDims, setCollapsedDims] = useState<Set<InterviewDimension>>(new Set());

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("加载画像失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const facts of Object.values(data)) {
      for (const fact of facts) {
        for (const tag of fact.topicTags) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!selectedTag) return data;
    const result: GroupedProfile = {} as GroupedProfile;
    for (const dim of Object.keys(data) as InterviewDimension[]) {
      result[dim] = data[dim].filter((f) => f.topicTags.includes(selectedTag));
    }
    return result;
  }, [data, selectedTag]);

  const totalCount = useMemo(() => {
    return Object.values(data).reduce((sum, facts) => sum + facts.length, 0);
  }, [data]);

  function toggleDim(dim: InterviewDimension) {
    setCollapsedDims((prev) => {
      const next = new Set(prev);
      if (next.has(dim)) next.delete(dim);
      else next.add(dim);
      return next;
    });
  }

  async function handleAdd(dimension: InterviewDimension, summary: string, topicTags: string[]) {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dimension, summary, topicTags })
    });
    if (!res.ok) throw new Error("add failed");
    await fetchProfiles();
  }

  async function handleUpdate(id: string, summary: string, topicTags: string[]) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, summary, topicTags })
    });
    if (!res.ok) throw new Error("update failed");
    await fetchProfiles();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/profile?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("delete failed");
    await fetchProfiles();
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

  if (error) {
    return (
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-6">
        <p className="text-sm text-[#a07060]">{error}</p>
        <button
          type="button"
          className="mt-3 wood-chip rounded-full px-4 py-1.5 text-xs tracking-[0.1em]"
          onClick={fetchProfiles}
        >
          重试
        </button>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="grid min-h-0 gap-4">
      {/* Summary bar */}
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(239,224,194,0.52)] p-4 md:p-5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">记忆库</p>
          <span className="wood-chip rounded-full px-3 py-1 text-xs tracking-[0.1em]">
            共 {totalCount} 条
          </span>
        </div>
        {totalCount === 0 && (
          <p className="mt-3 text-sm leading-7 text-[#5a4632]">
            还没有画像条目。完成访谈后系统会自动提取，你也可以手动添加。
          </p>
        )}
      </div>

      {/* Tag cloud */}
      {allTags.length > 0 && (
        <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-4">
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">主题标签</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`rounded-full border px-2.5 py-1 text-[0.65rem] tracking-[0.1em] transition-colors ${
                selectedTag === null
                  ? "border-[rgba(168,124,69,0.4)] bg-[rgba(191,133,73,0.15)] text-[#4a4038]"
                  : "border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] text-[#8a7a68] hover:bg-[rgba(255,249,239,0.6)]"
              }`}
              onClick={() => setSelectedTag(null)}
            >
              全部
            </button>
            {allTags.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                className={`rounded-full border px-2.5 py-1 text-[0.65rem] tracking-[0.1em] transition-colors ${
                  selectedTag === tag
                    ? "border-[rgba(168,124,69,0.4)] bg-[rgba(191,133,73,0.15)] text-[#4a4038]"
                    : "border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] text-[#8a7a68] hover:bg-[rgba(255,249,239,0.6)]"
                }`}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                {tag}
                <span className="ml-1 opacity-50">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dimension sections */}
      {DIMENSION_ORDER.map((dimKey) => {
        const dim = DIMENSION_META[dimKey];
        const facts = filteredData[dimKey];
        const totalInDim = data[dimKey].length;
        const isCollapsed = collapsedDims.has(dimKey);

        return (
          <div key={dimKey} className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.28)] p-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-2 text-left"
                onClick={() => toggleDim(dimKey)}
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full border border-[rgba(168,124,69,0.22)] bg-[rgba(191,133,73,0.1)] font-mono text-xs text-[#6a4f33]">
                  {dim.label}
                </span>
                <span className="text-sm font-medium text-[#2f2217]">{dim.full}维度</span>
                <span className="text-[0.65rem] text-[#8a7a68]">{totalInDim} 条</span>
                <span className={`text-[0.65rem] text-[#8a7a68] transition-transform ${isCollapsed ? "" : "rotate-180"}`}>
                  ▾
                </span>
              </button>
              <button
                type="button"
                className="rounded-full border border-[rgba(115,77,39,0.14)] px-3 py-1 text-[0.65rem] tracking-[0.1em] text-[#6a5e53] transition-colors hover:bg-[rgba(255,249,239,0.5)]"
                onClick={() => setAddDialog(dimKey)}
              >
                + 添加
              </button>
            </div>

            {!isCollapsed && (
              facts.length === 0 ? (
                <p className="mt-3 text-xs text-[#8a7a68]">
                  {selectedTag ? "该标签下没有匹配条目" : "暂无画像条目"}
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {facts.map((fact) => (
                    <MemoryCard
                      key={fact.id}
                      fact={fact}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )
            )}
          </div>
        );
      })}

      {/* Add dialog */}
      {addDialog && (
        <AddMemoryDialog
          defaultDimension={addDialog}
          onAdd={handleAdd}
          onClose={() => setAddDialog(null)}
        />
      )}
    </div>
  );
}
