"use client";

import React from "react";

import type { AIRuntimeCapability } from "@/features/admin-ai-runtime/types";
import type { AIRuntimeConfigPayload, AIRuntimeStatusPayload } from "@/features/admin-ai-runtime/api";
import {
  AdminAIRuntimeRequestError,
  fetchAIRuntimeDraft,
  fetchAIRuntimeHistory,
  fetchAdminAIRuntimeStatus,
  probeAIRuntimeDraftRequest,
  publishAIRuntimeDraftRequest,
  rollbackAIRuntimeConfigRequest,
  saveAIRuntimeDraftRequest
} from "@/features/admin-ai-runtime/api";
import { AIRuntimeCapabilityPane } from "@/components/admin-ai-runtime/ai-runtime-capability-pane";
import { AIRuntimeStatusCard } from "@/components/admin-ai-runtime/ai-runtime-status-card";

function getCapabilityLabel(capability: AIRuntimeCapability) {
  return capability === "chat" ? "聊天能力" : "向量嵌入能力";
}

export function AIRuntimePageClient({
  initialStatus,
  initialDrafts,
  initialHistory
}: {
  initialStatus: AIRuntimeStatusPayload[];
  initialDrafts: Record<AIRuntimeCapability, AIRuntimeConfigPayload | null>;
  initialHistory: Record<AIRuntimeCapability, AIRuntimeConfigPayload[]>;
}) {
  const [selectedCapability, setSelectedCapability] = React.useState<AIRuntimeCapability>("chat");
  const [status, setStatus] = React.useState(initialStatus);
  const [drafts, setDrafts] = React.useState(initialDrafts);
  const [history, setHistory] = React.useState(initialHistory);
  const [pendingAction, setPendingAction] = React.useState<"save" | "probe" | "publish" | null>(null);
  const [pendingRollbackId, setPendingRollbackId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function refreshCapability(capability: AIRuntimeCapability) {
    const [statusPayload, draftPayload, historyPayload] = await Promise.all([
      fetchAdminAIRuntimeStatus(),
      fetchAIRuntimeDraft(capability),
      fetchAIRuntimeHistory(capability)
    ]);

    setStatus(statusPayload.capabilities);
    setDrafts((current) => ({
      ...current,
      [capability]: draftPayload.draft
    }));
    setHistory((current) => ({
      ...current,
      [capability]: historyPayload.history
    }));
  }

  async function runAction(
    action: "save" | "probe" | "publish",
    capability: AIRuntimeCapability,
    executor: () => Promise<void>
  ) {
    setPendingAction(action);
    setNotice(null);

    try {
      await executor();
      await refreshCapability(capability);
      setNotice({
        tone: "success",
        text:
          action === "save"
            ? "草稿已保存。"
            : action === "probe"
              ? "连通性测试已完成。"
              : "配置已发布。"
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof AdminAIRuntimeRequestError ? error.code : "ADMIN_AI_RUNTIME_FAILED"
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRollback(capability: AIRuntimeCapability, rollbackFromId: string) {
    setPendingRollbackId(rollbackFromId);
    setNotice(null);

    try {
      await rollbackAIRuntimeConfigRequest(capability, rollbackFromId);
      await refreshCapability(capability);
      setNotice({
        tone: "success",
        text: "历史版本已经回滚并重新发布。"
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof AdminAIRuntimeRequestError ? error.code : "ADMIN_AI_RUNTIME_FAILED"
      });
    } finally {
      setPendingRollbackId(null);
    }
  }

  const selectedDraft = drafts[selectedCapability];
  const selectedHistory = history[selectedCapability];

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {status.map((item) => (
          <AIRuntimeStatusCard key={item.capability} status={item} />
        ))}
      </div>

      <section className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.44)] p-4 md:p-5">
        <div className="flex flex-wrap gap-3">
          {(["chat", "embedding"] as AIRuntimeCapability[]).map((capability) => (
            <button
              key={capability}
              type="button"
              className={`rounded-full border px-5 py-3 text-sm transition-colors ${
                capability === selectedCapability
                  ? "border-[rgba(115,77,39,0.28)] bg-[rgba(255,249,239,0.88)] text-[#2f2217]"
                  : "border-[rgba(115,77,39,0.14)] text-[#5a4632] hover:bg-[rgba(255,249,239,0.55)]"
              }`}
              onClick={() => setSelectedCapability(capability)}
            >
              {getCapabilityLabel(capability)}
            </button>
          ))}
        </div>
      </section>

      {notice ? (
        <p
          role="status"
          className={`rounded-[18px] border px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border-[rgba(115,77,39,0.18)] bg-[rgba(255,249,239,0.8)] text-[#5a4632]"
              : "border-[rgba(160,112,96,0.22)] bg-[rgba(255,245,241,0.84)] text-[#8a5440]"
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <AIRuntimeCapabilityPane
        capability={selectedCapability}
        draft={selectedDraft}
        history={selectedHistory}
        pendingAction={pendingAction}
        pendingRollbackId={pendingRollbackId}
        onSave={(payload) =>
          runAction("save", selectedCapability, async () => {
            const result = await saveAIRuntimeDraftRequest(selectedCapability, payload);
            setDrafts((current) => ({
              ...current,
              [selectedCapability]: result.draft
            }));
          })
        }
        onProbe={() =>
          runAction("probe", selectedCapability, async () => {
            await probeAIRuntimeDraftRequest(selectedCapability);
          })
        }
        onPublish={() =>
          runAction("publish", selectedCapability, async () => {
            await publishAIRuntimeDraftRequest(selectedCapability);
          })
        }
        onRollback={(rollbackFromId) => handleRollback(selectedCapability, rollbackFromId)}
      />
    </div>
  );
}
