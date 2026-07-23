"use client";

import { useId } from "react";

export function JournalEditor({
  title,
  content,
  titleLabel = "日志标题",
  contentLabel = "日志正文",
  contentHint,
  disabled = false,
  onChange
}: {
  title: string;
  content: string;
  titleLabel?: string;
  contentLabel?: string;
  contentHint?: string;
  disabled?: boolean;
  onChange: (next: { title: string; content: string }) => void;
}) {
  const titleId = useId();
  const contentId = useId();
  const hintId = useId();

  return (
    <div className="min-w-0" data-testid="journal-editor">
      <div className="space-y-2">
        <label htmlFor={titleId} className="block text-xs font-medium tracking-wide text-[var(--text-dim)]">
          {titleLabel}
        </label>
        <input
          id={titleId}
          value={title}
          maxLength={16}
          disabled={disabled}
          onChange={(event) => onChange({ title: event.target.value, content })}
          className="w-full min-w-0 border-0 border-b border-[var(--line-soft)] bg-transparent px-0 pb-2 font-display text-xl leading-snug text-ink outline-none transition focus:border-[var(--paper-deep)] disabled:cursor-default disabled:opacity-75"
        />
        <p className="text-right text-[0.68rem] tabular-nums text-[var(--text-faint)]">
          {[...title].length} / 16
        </p>
      </div>
      <div className="mt-5 space-y-2">
        <label htmlFor={contentId} className="block text-xs font-medium tracking-wide text-[var(--text-dim)]">
          {contentLabel}
        </label>
        <textarea
          id={contentId}
          value={content}
          maxLength={3000}
          disabled={disabled}
          aria-describedby={contentHint ? hintId : undefined}
          rows={14}
          onChange={(event) => onChange({ title, content: event.target.value })}
          className="min-h-64 w-full min-w-0 resize-y bg-transparent px-0 py-1 text-[0.92rem] leading-8 text-ink outline-none placeholder:text-[var(--text-faint)] disabled:cursor-default disabled:opacity-75"
        />
        <div className="flex flex-wrap items-start justify-between gap-2">
          {contentHint ? (
            <p id={hintId} className="max-w-[38ch] text-[0.7rem] leading-5 text-[var(--text-faint)]">
              {contentHint}
            </p>
          ) : <span />}
          <p className="text-[0.68rem] tabular-nums text-[var(--text-faint)]">
            {[...content].length} / 3000
          </p>
        </div>
      </div>
    </div>
  );
}
