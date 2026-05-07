"use client";

import { useState } from "react";

import type { MemoryFact } from "@prisma/client";

const SOURCE_LABEL: Record<string, string> = {
  ai_extracted: "AI 提取",
  user_added: "用户添加"
};

interface MemoryCardProps {
  fact: MemoryFact;
  onUpdate: (id: string, summary: string, topicTags: string[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function MemoryCard({ fact, onUpdate, onDelete }: MemoryCardProps) {
  const [editing, setEditing] = useState(false);
  const [editSummary, setEditSummary] = useState(fact.summary);
  const [editTags, setEditTags] = useState(fact.topicTags.join(", "));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const tags = editTags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
      await onUpdate(fact.id, editSummary, tags);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditSummary(fact.summary);
    setEditTags(fact.topicTags.join(", "));
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.44)] px-4 py-4">
        <textarea
          className="w-full resize-none border border-[rgba(115,77,39,0.18)] bg-white/60 px-3 py-2 text-sm leading-7 text-[#2f2217] outline-none focus:border-[rgba(168,124,69,0.4)]"
          rows={2}
          value={editSummary}
          onChange={(e) => setEditSummary(e.target.value)}
        />
        <input
          className="mt-2 w-full border border-[rgba(115,77,39,0.18)] bg-white/60 px-3 py-2 text-sm text-[#2f2217] outline-none focus:border-[rgba(168,124,69,0.4)]"
          placeholder="标签（逗号分隔）"
          value={editTags}
          onChange={(e) => setEditTags(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="wood-chip rounded-full px-4 py-1.5 text-xs tracking-[0.1em] transition-opacity hover:opacity-80"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            className="rounded-full border border-[rgba(115,77,39,0.14)] px-4 py-1.5 text-xs tracking-[0.1em] text-[#6a5e53] transition-colors hover:bg-[rgba(255,249,239,0.5)]"
            onClick={handleCancel}
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] px-4 py-4 transition-colors hover:bg-[rgba(255,249,239,0.52)]">
      <p className="text-sm leading-7 text-[#2f2217]">{fact.summary}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {fact.topicTags.map((tag) => (
          <span key={tag} className="wood-chip rounded-full px-2.5 py-0.5 text-[0.65rem] tracking-[0.1em]">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-[0.65rem] text-[#8a7a68]">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-[rgba(115,77,39,0.12)] bg-[rgba(255,248,238,0.48)] px-2 py-0.5 tracking-[0.12em]">
            {SOURCE_LABEL[fact.sourceType] ?? fact.sourceType}
          </span>
          {fact.sourceType === "ai_extracted" && (
            <span className="tracking-[0.08em]">
              置信度 {Math.round(fact.confidence * 100)}%
            </span>
          )}
        </div>

        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="rounded px-2 py-1 text-[0.65rem] tracking-[0.1em] text-[#6a5e53] transition-colors hover:bg-[rgba(255,249,239,0.6)]"
            onClick={() => setEditing(true)}
          >
            编辑
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-[0.65rem] tracking-[0.1em] text-[#a07060] transition-colors hover:bg-[rgba(255,230,220,0.4)]"
            onClick={() => onDelete(fact.id)}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
