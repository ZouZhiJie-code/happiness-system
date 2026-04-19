"use client";

import { useState, useTransition } from "react";

import { useInterviewStore } from "@/stores/interview-store";
import type { InterviewMessage } from "@/types/interview";

function MessageBubble({ message }: { message: InterviewMessage }) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-2xl rounded-[30px] border px-5 py-4 text-sm leading-8 shadow-soft ${
          isAssistant
            ? "border-[rgba(156,114,70,0.14)] bg-[rgba(255,248,238,0.44)] text-ink"
            : "border-[rgba(133,91,47,0.2)] bg-[linear-gradient(180deg,rgba(221,185,133,0.96),rgba(195,152,97,0.96))] text-[#2f2823]"
        }`}
      >
        <p className="mb-2 font-mono text-[0.65rem] tracking-[0.22em] text-current/55">
          {isAssistant ? "访谈者" : "我的回答"}
        </p>
        <p>{message.content}</p>
      </div>
    </div>
  );
}

export function InterviewShell() {
  const { sessionId, messages, snapshot, stage, turnCount, draft, setSession, hydrate, setDraft, reset } =
    useInterviewStore();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleStart() {
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/interview/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimension: "joy" })
      });

      if (!response.ok) {
        setError("访谈启动失败，请稍后再试。");
        return;
      }

      const data = await response.json();
      setSession(data.session);
    });
  }

  async function handleRecover() {
    if (!sessionId) return;

    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/interview/session/${sessionId}`);

      if (!response.ok) {
        setError("会话恢复失败，请重新开始。");
        return;
      }

      const data = await response.json();
      hydrate(data);
    });
  }

  async function handleSend() {
    if (!sessionId || !input.trim()) return;

    setError(null);
    const nextInput = input;
    setInput("");

    startTransition(async () => {
      const response = await fetch("/api/interview/session/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userMessage: nextInput,
          inputMode: "text"
        })
      });

      if (!response.ok) {
        setInput(nextInput);
        setError("这一轮提交失败了，请再试一次。");
        return;
      }

      const data = await response.json();
      hydrate(data.session);
    });
  }

  async function handleFinalize() {
    if (!sessionId) return;

    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/interview/session/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        setError("草稿生成失败，请稍后重试。");
        return;
      }

      const data = await response.json();
      hydrate(data.session);
      setDraft(data.draftEntry);
    });
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="page-shell rounded-[36px] p-6 md:p-7">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="archive-label">开心访谈</p>
            <h2 className="mt-3 font-display text-3xl text-ink md:text-4xl">今晚的记录从一段具体经历开始。</h2>
            <p className="mt-3 max-w-2xl text-sm leading-8 text-ink/76">
              访谈会逐步从事件进入感受，再进入为什么重要。页面左侧负责专注表达，右侧负责让结构慢慢显形。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRecover}
              disabled={!sessionId || isPending}
              className="rounded-full border border-[rgba(144,100,56,0.18)] bg-[linear-gradient(180deg,rgba(255,248,238,0.62),rgba(241,225,195,0.56))] px-4 py-2 text-sm text-ink/72 disabled:cursor-not-allowed disabled:opacity-40"
            >
              恢复会话
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={isPending}
              className="rounded-full border border-[rgba(115,74,37,0.24)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-5 py-2 text-sm text-[#2f2823] transition duration-300 hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:opacity-50"
            >
              {messages.length > 0 ? "重新开始" : "开始访谈"}
            </button>
          </div>
        </div>

        <div className="relative z-10 mt-6 flex min-h-[460px] flex-col gap-4 rounded-[30px] border border-[rgba(119,79,40,0.16)] bg-[linear-gradient(180deg,rgba(251,244,232,0.78),rgba(232,212,178,0.96)),repeating-linear-gradient(90deg,rgba(118,78,37,0.08)_0_2px,rgba(255,249,239,0.05)_2px_12px,rgba(134,92,49,0.07)_12px_20px,transparent_20px_38px)] p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]">
          <div className="flex items-center justify-between border-b border-[rgba(156,114,70,0.12)] pb-4">
            <div>
              <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">书写区</p>
              <p className="mt-2 text-sm text-ink/62">建议先写具体事件，再补充为什么开心。</p>
            </div>
            <p className="font-mono text-[0.68rem] tracking-[0.24em] text-ink/58">
              {sessionId ? "会话进行中" : "尚未开始"}
            </p>
          </div>
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-[26px] border border-dashed border-[rgba(206,179,142,0.34)] bg-[linear-gradient(180deg,rgba(243,231,211,0.94),rgba(231,215,188,0.9))] p-8 text-center text-[#5c4e41] shadow-[0_18px_40px_rgba(5,8,17,0.16)]">
              点击“开始访谈”后，系统会从一个具体问题进入，让这次开心经历逐步成文。
            </div>
          ) : (
            messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}
        </div>

        <div className="wood-dialog relative z-10 mt-6 rounded-[30px] p-5 shadow-[0_24px_60px_rgba(130,92,45,0.15)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">底部对话框</p>
              <label htmlFor="interview-input" className="mt-2 block text-sm leading-7 text-[#4e4135]">
                把这一轮想到的内容直接写下来，先说具体发生了什么，再补充当时为什么会开心。
              </label>
            </div>
            <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6b6259]">
              第 {turnCount || 0} 轮
            </p>
          </div>
          <textarea
            id="interview-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="例如：今天和同事一起把一个棘手问题解决了，我真的松了一口气。"
            className="mt-4 min-h-36 w-full resize-none rounded-[24px] border border-[rgba(133,91,47,0.22)] bg-[linear-gradient(180deg,rgba(251,245,235,0.94),rgba(241,227,202,0.95)),repeating-linear-gradient(90deg,rgba(144,98,52,0.05)_0_1px,transparent_1px_12px,rgba(255,250,241,0.06)_12px_18px,transparent_18px_28px)] px-4 py-4 text-sm leading-8 text-[#241d16] shadow-[inset_0_1px_0_rgba(255,255,255,0.58),0_10px_24px_rgba(125,91,47,0.08)] outline-none transition placeholder:text-[#8d6b4a] focus:border-[#9f6838] focus:bg-[linear-gradient(180deg,rgba(252,247,239,0.98),rgba(244,231,207,0.98))] focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.68),0_0_0_4px_rgba(169,111,61,0.12)]"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#5a4a3c]">
              当前轮次 {turnCount} {stage ? `· 当前阶段 ${stage}` : null}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSend}
                disabled={!sessionId || !input.trim() || isPending}
                className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-5 py-2 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                发送回答
              </button>
              <button
                type="button"
                onClick={handleFinalize}
                disabled={!sessionId || !messages.length || !snapshot || isPending}
                className="rounded-full border border-[rgba(168,124,69,0.24)] bg-[rgba(250,241,225,0.56)] px-5 py-2 text-sm text-[#5c452e] transition hover:bg-[rgba(250,241,225,0.86)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                生成草稿
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-[rgba(168,124,69,0.24)] bg-[rgba(244,232,210,0.44)] px-5 py-2 text-sm text-[#715a43] transition hover:bg-[rgba(244,232,210,0.7)]"
              >
                清空本地状态
              </button>
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-[#9f3a2f]">{error}</p> : null}
        </div>
      </div>

        <div className="space-y-6">
          <div className="wood-board rounded-[32px] p-6">
            <div className="relative z-10">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-[#6a5e53]">结构快照</p>
              <h3 className="mt-3 font-display text-2xl text-[#2f2217] md:text-3xl">当前抽取快照</h3>
              <p className="mt-3 text-sm leading-7 text-[#5a4632]">
                这里展示系统目前认为已经抓住的内容。它不代替你的表达，只帮助你看见哪些部分已经清楚，哪些还需要继续追问。
              </p>
          </div>
          <dl className="relative z-10 mt-6 space-y-4 text-sm text-[#2f2217]">
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-[#6a5e53]">事件</dt>
              <dd className="mt-1">{snapshot?.event ?? "待识别"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-[#6a5e53]">感受</dt>
              <dd className="mt-1">{snapshot?.feeling ?? "待识别"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-[#6a5e53]">为什么重要</dt>
              <dd className="mt-1">{snapshot?.whyItMattered ?? "待识别"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-[#6a5e53]">开心类型 / 模式</dt>
              <dd className="mt-1">
                {snapshot?.happinessType ?? snapshot?.selfPattern ?? "待识别"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="wood-dialog rounded-[32px] p-6">
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">草稿预览</p>
          <h3 className="mt-3 font-display text-2xl text-[#221d17] md:text-3xl">日志草稿预览</h3>
          {draft ? (
            <div className="mt-5 space-y-3 text-sm leading-8 text-[#3f352c]">
              <p className="font-display text-xl text-[#221d17]">{draft.title}</p>
              <p className="whitespace-pre-line">{draft.content}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-8 text-[#5d5042]">当会话完成后，这里会显示一份可编辑的开心日志草稿，像一张刚刚整理出来的初稿页。</p>
          )}
        </div>
      </div>
    </section>
  );
}
