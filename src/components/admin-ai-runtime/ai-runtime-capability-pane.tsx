"use client";

import React from "react";

import { Divider } from "@/components/ui";
import type { AIRuntimeCapability } from "@/features/admin-ai-runtime/types";
import type { AIRuntimeConfigPayload } from "@/features/admin-ai-runtime/api";
import { AIRuntimeDraftForm } from "@/components/admin-ai-runtime/ai-runtime-draft-form";
import { AIRuntimeHistoryTable } from "@/components/admin-ai-runtime/ai-runtime-history-table";

export function AIRuntimeCapabilityPane({
  capability,
  draft,
  history,
  pendingAction,
  pendingRollbackId,
  onSave,
  onProbe,
  onPublish,
  onRollback
}: {
  capability: AIRuntimeCapability;
  draft: AIRuntimeConfigPayload | null;
  history: AIRuntimeConfigPayload[];
  pendingAction: "save" | "probe" | "publish" | null;
  pendingRollbackId: string | null;
  onSave: (payload: Record<string, unknown>) => Promise<void> | void;
  onProbe: () => Promise<void> | void;
  onPublish: () => Promise<void> | void;
  onRollback: (rollbackFromId: string) => Promise<void> | void;
}) {
  return (
    <div className="grid gap-5">
      <AIRuntimeDraftForm
        capability={capability}
        draft={draft}
        pendingAction={pendingAction}
        onSave={onSave}
        onProbe={onProbe}
        onPublish={onPublish}
      />
      <Divider />
      <AIRuntimeHistoryTable
        capability={capability}
        history={history}
        pendingRollbackId={pendingRollbackId}
        onRollback={onRollback}
      />
    </div>
  );
}
