"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ConsentState = {
  policyVersion: string;
  decisionRequired: boolean;
  participated: boolean;
};

export function AIQualityConsentBanner() {
  const [state, setState] = useState<ConsentState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/ai-feedback/consent")
      .then(async (response) => (response.ok ? (await response.json()) as ConsentState : null))
      .then((nextState) => {
        if (active) setState(nextState);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function decide(participate: boolean) {
    setSaving(true);
    try {
      const response = await fetch("/api/ai-feedback/consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participate })
      });
      if (response.ok) setState((await response.json()) as ConsentState);
    } finally {
      setSaving(false);
    }
  }

  if (!state?.decisionRequired) return null;

  return (
    <section
      aria-label="AI 质量优化授权"
      className="mx-1 mb-3 border-y border-[var(--line-soft)] px-2 py-3 text-sm text-[#5f4a37]"
    >
      <p className="font-medium text-[#3f3024]">选择是否参与 AI 质量改进</p>
      <p className="mt-1 leading-6">
        这是一项可选授权。参与后，我们会将回复、必要上下文和主动反馈用于质量评估与改进；你可以随时在设置中停止参与。
        <Link href="/legal/privacy" target="_blank" className="ml-1 underline underline-offset-4">
          查看政策
        </Link>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void decide(true)}
          className="rounded-[var(--radius-control)] bg-[#d7b07b] px-3 py-1.5 text-xs font-medium text-[#302317] disabled:opacity-50"
        >
          同意并参与优化
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void decide(false)}
          className="rounded-[var(--radius-control)] px-3 py-1.5 text-xs text-[#745b43] hover:bg-black/5 disabled:opacity-50"
        >
          暂不参与
        </button>
      </div>
    </section>
  );
}
