"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ActionButton } from "@/components/ui";

type ConsentState = {
  policyVersion: string;
  decisionRequired: boolean;
  participated: boolean;
};

export function AIQualityConsentSettings() {
  const [state, setState] = useState<ConsentState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/ai-feedback/consent")
      .then(async (response) => {
        if (!response.ok) throw new Error("CONSENT_LOAD_FAILED");
        return (await response.json()) as ConsentState;
      })
      .then((nextState) => {
        if (active) setState(nextState);
      })
      .catch(() => {
        if (active) setError("质量改进设置暂时无法读取");
      });
    return () => {
      active = false;
    };
  }, []);

  async function update(participate: boolean) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/ai-feedback/consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participate })
      });
      if (!response.ok) throw new Error("CONSENT_UPDATE_FAILED");
      setState((await response.json()) as ConsentState);
    } catch {
      setError("设置保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="AI 质量改进设置" className="grid gap-3">
      <div>
        <p className="text-sm font-medium text-ink">AI 质量改进</p>
        <p className="mt-1 text-sm leading-7 text-[var(--text-dim)]">
          {state?.participated
            ? "当前正在参与。你的主动反馈和必要上下文可用于自动评估与质量改进。"
            : "当前未参与。系统只运行本地确定性质量规则，不会将你的上下文发送给质量裁判或加入 Few-shot。"}
          <Link href="/legal/privacy" target="_blank" className="ml-1 underline underline-offset-4">
            查看隐私说明
          </Link>
        </p>
      </div>
      {error ? <p role="alert" className="text-sm text-[#8a5440]">{error}</p> : null}
      <div>
        <ActionButton
          type="button"
          variant={state?.participated ? "secondary" : "primary"}
          disabled={saving || !state}
          onClick={() => void update(!state?.participated)}
        >
          {saving ? "保存中…" : state?.participated ? "停止参与" : "参加质量改进"}
        </ActionButton>
      </div>
    </section>
  );
}
