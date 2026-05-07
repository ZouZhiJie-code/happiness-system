"use client";

import { useState } from "react";

import type { InterviewDimension } from "@prisma/client";

const DIMENSION_OPTIONS: { value: InterviewDimension; label: string }[] = [
  { value: "joy", label: "悦" },
  { value: "fulfillment", label: "实" },
  { value: "reflection", label: "思" },
  { value: "improvement", label: "改" },
  { value: "gratitude", label: "谢" }
];

interface AddMemoryDialogProps {
  defaultDimension?: InterviewDimension;
  onAdd: (dimension: InterviewDimension, summary: string, topicTags: string[]) => Promise<void>;
  onClose: () => void;
}

export function AddMemoryDialog({ defaultDimension = "joy", onAdd, onClose }: AddMemoryDialogProps) {
  const [dimension, setDimension] = useState<InterviewDimension>(defaultDimension);
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (summary.trim().length < 2) {
      setError("摘要至少 2 个字");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const topicTags = tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
      await onAdd(dimension, summary.trim(), topicTags);
      onClose();
    } catch {
      setError("添加失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" role="dialog" aria-modal="true">
      <div className="w-full max-w-md border border-[rgba(115,77,39,0.18)] bg-[rgba(249,238,216,0.98)] p-5 shadow-lg">
        <h2 className="font-display text-xl text-[#231d17]">添加画像条目</h2>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
          <div>
            <label className="block font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">维度</label>
            <div className="mt-2 flex gap-2">
              {DIMENSION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs tracking-[0.12em] transition-colors ${
                    dimension === opt.value
                      ? "border-[rgba(168,124,69,0.4)] bg-[rgba(191,133,73,0.15)] text-[#4a4038]"
                      : "border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] text-[#8a7a68] hover:bg-[rgba(255,249,239,0.6)]"
                  }`}
                  onClick={() => setDimension(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">画像摘要</label>
            <textarea
              className="mt-2 w-full resize-none border border-[rgba(115,77,39,0.18)] bg-white/60 px-3 py-2 text-sm leading-7 text-[#2f2217] outline-none focus:border-[rgba(168,124,69,0.4)]"
              rows={3}
              placeholder="例如：独处时幸福感显著提升"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">主题标签</label>
            <input
              className="mt-2 w-full border border-[rgba(115,77,39,0.18)] bg-white/60 px-3 py-2 text-sm text-[#2f2217] outline-none focus:border-[rgba(168,124,69,0.4)]"
              placeholder="逗号分隔，例如：独处, 能量恢复"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-[#a07060]">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-full border border-[rgba(115,77,39,0.14)] px-4 py-2 text-xs tracking-[0.1em] text-[#6a5e53] transition-colors hover:bg-[rgba(255,249,239,0.5)]"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className="wood-chip rounded-full px-5 py-2 text-xs tracking-[0.12em] transition-opacity hover:opacity-80"
              disabled={saving}
            >
              {saving ? "添加中…" : "添加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
