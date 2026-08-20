"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  JournalDayWorkspace,
  type JournalDayArchiveItem
} from "@/components/journal/journal-day-workspace";
import { ActionButton } from "@/components/ui";
import {
  JOURNAL_PREVIEW_MODE,
  type JournalPreviewCaseId,
  type JournalPreviewSessionView
} from "@/server/services/journal-preview/contract";

const STORAGE_KEY = "daily-light:journal-fixed-preview:v1";

type StoredPreview = {
  sessionId: string;
  selectedCaseId: JournalPreviewCaseId;
};

function previewHeaders(sessionId?: string, caseId?: JournalPreviewCaseId) {
  return {
    "x-daily-light-preview": JOURNAL_PREVIEW_MODE,
    ...(sessionId ? { "x-daily-light-preview-session": sessionId } : {}),
    ...(caseId ? { "x-daily-light-preview-case": caseId } : {})
  };
}

async function readPayload<T>(response: Response) {
  const payload = await response.json().catch(() => null) as T | { error?: unknown } | null;
  if (!response.ok) {
    const code = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "JOURNAL_PREVIEW_SESSION_FAILED";
    throw new Error(code);
  }
  return payload as T;
}

async function createPreviewSession() {
  const response = await fetch("/api/journal/preview/session", {
    method: "POST",
    headers: previewHeaders(),
    cache: "no-store"
  });
  return readPayload<JournalPreviewSessionView>(response);
}

async function restorePreviewSession(sessionId: string) {
  const response = await fetch("/api/journal/preview/session", {
    headers: previewHeaders(sessionId),
    cache: "no-store"
  });
  return readPayload<JournalPreviewSessionView>(response);
}

function readStoredPreview(): StoredPreview | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null") as Partial<StoredPreview> | null;
    if (!value || typeof value.sessionId !== "string" || typeof value.selectedCaseId !== "string") return null;
    return value as StoredPreview;
  } catch {
    return null;
  }
}

function storePreview(value: StoredPreview | null) {
  if (!value) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function DailyLightJournalFixedPreview() {
  const [session, setSession] = useState<JournalPreviewSessionView | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<JournalPreviewCaseId | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const beginSession = useCallback(async () => {
    const next = await createPreviewSession();
    const selected = next.cases[0]?.caseId;
    if (!selected) throw new Error("JOURNAL_PREVIEW_CASE_SET_INVALID");
    setSession(next);
    setSelectedCaseId(selected);
    storePreview({ sessionId: next.sessionId, selectedCaseId: selected });
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setBusy(true);
      setError(null);
      const stored = readStoredPreview();
      try {
        if (!stored) {
          const next = await createPreviewSession();
          if (!active) return;
          const selected = next.cases[0]?.caseId;
          if (!selected) throw new Error("JOURNAL_PREVIEW_CASE_SET_INVALID");
          setSession(next);
          setSelectedCaseId(selected);
          storePreview({ sessionId: next.sessionId, selectedCaseId: selected });
          return;
        }
        const next = await restorePreviewSession(stored.sessionId);
        if (!active) return;
        const selected = next.cases.some((item) => item.caseId === stored.selectedCaseId)
          ? stored.selectedCaseId
          : next.cases[0]?.caseId;
        if (!selected) throw new Error("JOURNAL_PREVIEW_CASE_SET_INVALID");
        setSession(next);
        setSelectedCaseId(selected);
        storePreview({ sessionId: next.sessionId, selectedCaseId: selected });
      } catch (loadError) {
        if (!active) return;
        storePreview(null);
        setError(loadError instanceof Error ? loadError.message : "JOURNAL_PREVIEW_SESSION_FAILED");
      } finally {
        if (active) setBusy(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const selectedCase = session?.cases.find((item) => item.caseId === selectedCaseId) ?? null;
  const requestContext = useMemo(() => selectedCase && session ? ({
    headers: previewHeaders(session.sessionId, selectedCase.caseId)
  }) : undefined, [selectedCase, session]);
  const archives = useMemo<JournalDayArchiveItem[]>(() => session?.cases.map((item) => ({
    id: item.caseId,
    entryDate: item.entryDate,
    title: `${item.label} · ${item.editable ? "可编辑" : "只读"}`,
    displayStatus: "saved",
    selected: item.caseId === selectedCaseId
  })) ?? [], [selectedCaseId, session]);

  const selectCase = (item: JournalDayArchiveItem) => {
    if (!session) return;
    const caseId = item.id as JournalPreviewCaseId;
    if (!session.cases.some((candidate) => candidate.caseId === caseId)) return;
    setSelectedCaseId(caseId);
    storePreview({ sessionId: session.sessionId, selectedCaseId: caseId });
  };

  const reset = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/journal/preview/session", {
        method: "DELETE",
        headers: previewHeaders(session.sessionId),
        cache: "no-store"
      });
      storePreview(null);
      await beginSession();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "JOURNAL_PREVIEW_SESSION_FAILED");
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setBusy(true);
    setError(null);
    try {
      await beginSession();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "JOURNAL_PREVIEW_SESSION_FAILED");
    } finally {
      setBusy(false);
    }
  };

  if (busy && !session) {
    return <div className="grid min-h-[70dvh] place-items-center bg-[var(--paper-main)] text-sm text-[var(--text-dim)]" role="status">正在准备固定案例…</div>;
  }

  if (!session || !selectedCase || !requestContext) {
    return (
      <main className="grid min-h-[70dvh] place-items-center bg-[var(--paper-main)] px-6 text-center">
        <div>
          <h1 className="font-ui text-2xl font-semibold text-ink">固定案例暂时没打开</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--text-dim)]">
            请在本地隔离环境开启固定案例，并使用已登录的验收账号。
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <ActionButton type="button" variant="primary" onClick={() => void retry()}>重新加载</ActionButton>
            <Link href="/login?next=/preview/daily-light-journal-fixed" className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-4 text-sm text-[var(--text-dim)]">去登录</Link>
          </div>
          {error ? <p className="mt-4 text-xs text-[var(--text-faint)]">{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100dvh-var(--site-header-viewport-offset))] min-h-0 flex-col bg-[var(--paper-main)]">
      <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-3 bg-[var(--header-surface)] px-4 py-2 md:px-6">
        <p className="text-xs text-[var(--text-dim)]">
          固定六案例 · 五条只读 · v7r4 A1 可编辑 · 模型调用 0
        </p>
        <ActionButton type="button" variant="ghost" onClick={() => void reset()} disabled={busy}>
          {busy ? "正在重置" : "恢复固定基线"}
        </ActionButton>
      </div>
      {error ? <p role="alert" className="shrink-0 bg-[var(--paper-soft)] px-4 py-2 text-sm text-[var(--paper-deep)]">{error}</p> : null}
      <div className="min-h-0 flex-1">
        <JournalDayWorkspace
          key={`${session.sessionId}:${selectedCase.caseId}`}
          entryDate={selectedCase.entryDate}
          requestContext={requestContext}
          readOnly={!selectedCase.editable}
          archives={archives}
          onSelectArchive={selectCase}
        />
      </div>
    </main>
  );
}
