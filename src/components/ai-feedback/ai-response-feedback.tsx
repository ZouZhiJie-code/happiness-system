"use client";

import { useEffect, useId, useRef, useState } from "react";

type FeedbackVote = "upvote" | "downvote";
type FeedbackTag = { code: string; label: string };
type FeedbackRecord = {
  vote: FeedbackVote;
  tags: string[];
  comment: string | null;
  status: "active" | "revoked";
};
type FeedbackContext = {
  tags: Record<FeedbackVote, FeedbackTag[]>;
  feedback: FeedbackRecord | null;
};

function ThumbsUpIcon({ selected }: { selected: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill={selected ? "currentColor" : "white"}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88M7 10v12"
      />
    </svg>
  );
}

function ThumbsDownIcon({ selected }: { selected: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill={selected ? "currentColor" : "white"}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88M17 14V2"
      />
    </svg>
  );
}

function VoteButton({
  vote,
  selected,
  disabled,
  tooltipId,
  onClick
}: {
  vote: FeedbackVote;
  selected: boolean;
  disabled: boolean;
  tooltipId: string;
  onClick: () => void;
}) {
  const label = vote === "upvote" ? "赞" : "踩";
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        aria-describedby={tooltipId}
        disabled={disabled}
        onClick={onClick}
        className={`grid size-8 place-items-center rounded-[var(--radius-control)] transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a57548] disabled:opacity-50 ${
          selected ? "text-[var(--text-dim)]" : "text-[#806951]"
        }`}
      >
        {vote === "upvote" ? <ThumbsUpIcon selected={selected} /> : <ThumbsDownIcon selected={selected} />}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 rounded-[var(--radius-control)] bg-[#3f3329] px-2 py-1 text-[11px] leading-none text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

export function AIResponseFeedback({
  traceId,
  compact = false
}: {
  traceId: string;
  compact?: boolean;
}) {
  const [feedback, setFeedback] = useState<FeedbackRecord | null>(null);
  const [tagOptions, setTagOptions] = useState<Record<FeedbackVote, FeedbackTag[]>>({
    upvote: [],
    downvote: []
  });
  const [editingVote, setEditingVote] = useState<FeedbackVote | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const tooltipPrefix = useId();
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearMessageTimer() {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }
  }

  function showSuccessMessage(vote: FeedbackVote) {
    clearMessageTimer();
    setMessage(vote === "upvote" ? "谢谢你的反馈" : "谢谢你帮助我们变得更好");
    messageTimerRef.current = setTimeout(() => {
      setMessage(null);
      messageTimerRef.current = null;
    }, 1000);
  }

  useEffect(() => {
    let active = true;
    clearMessageTimer();
    setMessage(null);
    setEditingVote(null);
    void fetch(`/api/ai-feedback/${traceId}`)
      .then(async (response) => (response.ok ? (await response.json()) as FeedbackContext : null))
      .then((context) => {
        if (!active || !context) return;
        setTagOptions(context.tags);
        setFeedback(context.feedback);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      clearMessageTimer();
    };
  }, [traceId]);

  function beginEditing(vote: FeedbackVote) {
    clearMessageTimer();
    setMessage(null);
    setEditingVote(vote);
    if (feedback?.vote === vote) {
      setSelectedTags(feedback.tags);
      setComment(feedback.comment ?? "");
    } else {
      setSelectedTags([]);
      setComment("");
    }
  }

  function cancelEditing() {
    setEditingVote(null);
    setSelectedTags([]);
    setComment("");
  }

  async function submit() {
    if (!editingVote) return;
    const vote = editingVote;
    setBusy(true);
    clearMessageTimer();
    setMessage(null);
    try {
      const response = await fetch(`/api/ai-feedback/${traceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote, tags: selectedTags, comment: comment.trim() || null })
      });
      if (!response.ok) {
        setMessage("反馈提交失败，请稍后重试");
        return;
      }
      const saved = (await response.json()) as FeedbackRecord;
      setFeedback(saved);
      cancelEditing();
      showSuccessMessage(vote);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    clearMessageTimer();
    setMessage(null);
    try {
      const response = await fetch(`/api/ai-feedback/${traceId}`, { method: "DELETE" });
      if (response.ok) {
        setFeedback(null);
        cancelEditing();
      } else {
        setMessage("反馈取消失败，请稍后重试");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleVoteClick(vote: FeedbackVote) {
    if (editingVote) {
      if (editingVote === vote || feedback?.vote === vote) {
        cancelEditing();
        return;
      }
      beginEditing(vote);
      return;
    }

    if (feedback?.vote === vote) {
      void revoke();
      return;
    }
    beginEditing(vote);
  }

  const visibleVote = editingVote ?? feedback?.vote ?? null;
  const availableTags = editingVote ? tagOptions[editingVote] : [];

  return (
    <div className={`${compact ? "mt-2" : "mt-1 ml-3"} text-xs text-[#806951]`} data-testid={`ai-feedback-${traceId}`}>
      <div className="flex flex-wrap items-center gap-1">
        <VoteButton
          vote="upvote"
          selected={visibleVote === "upvote"}
          disabled={busy}
          tooltipId={`${tooltipPrefix}-upvote`}
          onClick={() => handleVoteClick("upvote")}
        />
        <VoteButton
          vote="downvote"
          selected={visibleVote === "downvote"}
          disabled={busy}
          tooltipId={`${tooltipPrefix}-downvote`}
          onClick={() => handleVoteClick("downvote")}
        />
        {message ? <span role="status">{message}</span> : null}
      </div>

      {editingVote ? (
        <div className="mt-2 max-w-xl border-t border-[var(--line-soft)] pt-3">
          <p className="font-medium text-[#594430]">
            {editingVote === "upvote" ? "这条内容哪些地方做得好？" : "这条内容哪里需要改进？"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const selected = selectedTags.includes(tag.code);
              return (
                <button
                  key={tag.code}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setSelectedTags((current) =>
                      selected ? current.filter((item) => item !== tag.code) : [...current, tag.code]
                    )
                  }
                  className="rounded-[var(--radius-control)] border border-[var(--line-soft)] px-2.5 py-1.5 aria-pressed:border-[#a57548] aria-pressed:bg-[rgba(161,117,72,0.12)]"
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={editingVote === "upvote" ? "也可以具体说说哪些地方对你有帮助" : "也可以具体说说哪里有问题"}
            className="mt-3 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 outline-none focus:border-[#a57548]"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy || (editingVote === "downvote" && selectedTags.length === 0 && !comment.trim())}
              onClick={() => void submit()}
              className="rounded-[var(--radius-control)] bg-[#d7b07b] px-3 py-1.5 font-medium text-[#302317] disabled:opacity-50"
            >
              提交反馈
            </button>
            <button type="button" disabled={busy} onClick={cancelEditing} className="px-3 py-1.5">
              取消
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
