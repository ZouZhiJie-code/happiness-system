import { describe, expect, it } from "vitest";

import {
  createJournalPreviewService
} from "@/server/services/journal-preview/service";
import { hasLocalPrivatePackage } from "../helpers/local-private-assets";

const HAS_JOURNAL_PREVIEW_PACKAGE = hasLocalPrivatePackage({
  root: "artifacts/journal-generation-evaluation/.private/formal/record-card-v3-daily",
  directoryPrefix: "gi088-record-card-v3-daily-regression-"
});

describe.skipIf(!HAS_JOURNAL_PREVIEW_PACKAGE)("Daily Light journal fixed Preview service", () => {
  it("loads exactly six sealed cases without model calls", async () => {
    const service = createJournalPreviewService({
      id: () => "preview-session-1",
      now: () => new Date("2026-08-12T00:00:00.000Z")
    });
    const session = await service.createSession("user-1");

    expect(session.mode).toBe("fixed-six-v1");
    expect(session.modelCalls).toBe(0);
    expect(session.cases.map((item) => item.caseId)).toEqual([
      "v6-a1",
      "v7-a1",
      "v7-a2",
      "v7r2-a1",
      "v7r2-a2",
      "v7r4-a1"
    ]);
    expect(session.cases.filter((item) => item.editable).map((item) => item.caseId)).toEqual(["v7r4-a1"]);
  });

  it("returns the sealed card and daily result with a saved baseline", async () => {
    const service = createJournalPreviewService({ id: () => "preview-session-2" });
    const session = await service.createSession("user-1");
    const item = session.cases.find((candidate) => candidate.caseId === "v6-a1")!;
    const day = await service.readDay("user-1", session.sessionId, item.caseId, item.entryDate);

    expect(day.view.displayStatus).toBe("saved");
    expect(day.view.entry?.status).toBe("saved");
    expect(day.record.content.trim()).toBeTruthy();
    expect(day.view.savedSources).toHaveLength(1);
    expect(day.view.savedSources[0]?.entryId).toBe(item.eventEntryId);
    expect(day.preview.modelCalls).toBe(0);
  });

  it("keeps the five read-only cases immutable", async () => {
    const service = createJournalPreviewService({ id: () => "preview-session-3" });
    const session = await service.createSession("user-1");
    const item = session.cases.find((candidate) => candidate.caseId === "v6-a1")!;
    const day = await service.readDay("user-1", session.sessionId, item.caseId, item.entryDate);

    await expect(service.updateRecord({
      userId: "user-1",
      sessionId: session.sessionId,
      caseId: item.caseId,
      entryId: item.eventEntryId,
      expectedContentRevision: 1,
      title: "改写标题",
      content: "改写正文"
    })).rejects.toThrow("JOURNAL_PREVIEW_CASE_READ_ONLY");
    const after = await service.readDay("user-1", session.sessionId, item.caseId, item.entryDate);
    expect(after.record.content).toBe(day.record.content);
    expect(after.view.displayStatus).toBe("saved");
  });

  it("runs the v8 A1 edit, stale, update and manual-preservation flow", async () => {
    const service = createJournalPreviewService({
      id: () => "preview-session-4",
      now: () => new Date("2026-08-12T00:00:00.000Z")
    });
    const session = await service.createSession("user-1");
    const item = session.cases.find((candidate) => candidate.caseId === "v7r4-a1")!;
    const baseline = await service.readDay("user-1", session.sessionId, item.caseId, item.entryDate);

    const edited = await service.updateRecord({
      userId: "user-1",
      sessionId: session.sessionId,
      caseId: item.caseId,
      entryId: item.eventEntryId,
      expectedContentRevision: 1,
      title: `${baseline.record.title}（编辑）`,
      content: `${baseline.record.content}\n\n我补充了一句。`
    });
    await service.saveRecord({
      userId: "user-1",
      sessionId: session.sessionId,
      caseId: item.caseId,
      entryId: item.eventEntryId,
      expectedContentRevision: edited.contentRevision
    });
    const stale = await service.readDay("user-1", session.sessionId, item.caseId, item.entryDate);
    expect(stale.view.displayStatus).toBe("stale");
    expect(stale.view.sourceSignature).not.toBe(baseline.view.sourceSignature);

    const manual = await service.updateDailyEntry({
      userId: "user-1",
      sessionId: session.sessionId,
      caseId: item.caseId,
      entryId: item.dailyEntryId,
      expectedContentRevision: 1,
      title: stale.view.entry!.title,
      content: `${stale.view.entry!.content}\n\n我的手动补充。`
    });
    const updated = await service.generateDaily({
      userId: "user-1",
      sessionId: session.sessionId,
      caseId: item.caseId,
      task: "update",
      expectedSourceSignature: stale.view.sourceSignature,
      expectedContentRevision: manual.contentRevision
    });
    expect(updated.preview.resultKind).toBe("fixed_update_sample");
    expect(updated.preview.modelCalls).toBe(0);
    expect(updated.entry.content).toContain("我的手动补充。");
    expect(updated.entry.content).toContain("我补充了一句。");
    expect(updated.entry.status).toBe("modified");

    await service.saveDailyEntry({
      userId: "user-1",
      sessionId: session.sessionId,
      caseId: item.caseId,
      entryId: item.dailyEntryId,
      expectedContentRevision: updated.entry.contentRevision
    });
    const saved = await service.readDay("user-1", session.sessionId, item.caseId, item.entryDate);
    expect(saved.view.displayStatus).toBe("saved");
    expect(saved.view.entry?.savedRevision).toBe(updated.entry.contentRevision);
  });

  it("rejects stale revisions and resets a session to the sealed baseline", async () => {
    const service = createJournalPreviewService({ id: () => "preview-session-5" });
    const first = await service.createSession("user-1");
    const item = first.cases.find((candidate) => candidate.caseId === "v7r4-a1")!;
    const day = await service.readDay("user-1", first.sessionId, item.caseId, item.entryDate);

    await expect(service.updateRecord({
      userId: "user-1",
      sessionId: first.sessionId,
      caseId: item.caseId,
      entryId: item.eventEntryId,
      expectedContentRevision: 99,
      title: "过期",
      content: "过期"
    })).rejects.toThrow("JOURNAL_PREVIEW_ENTRY_VERSION_CONFLICT");

    service.resetSession(first.sessionId);
    const second = await service.createSession("user-1");
    const reset = await service.readDay("user-1", second.sessionId, item.caseId, item.entryDate);
    expect(reset.record.contentRevision).toBe(1);
    expect(reset.record.content).toBe(day.record.content);
    expect(reset.view.displayStatus).toBe("saved");
  });

  it("rejects cross-case, cross-session and late update requests", async () => {
    const service = createJournalPreviewService();
    const first = await service.createSession("user-1");
    const second = await service.createSession("user-1");
    const editable = first.cases.find((candidate) => candidate.caseId === "v7r4-a1")!;
    const other = first.cases.find((candidate) => candidate.caseId === "v7r2-a2")!;
    const baseline = await service.readDay("user-1", first.sessionId, editable.caseId, editable.entryDate);

    await expect(service.updateRecord({
      userId: "user-1",
      sessionId: first.sessionId,
      caseId: editable.caseId,
      entryId: other.eventEntryId,
      expectedContentRevision: 1,
      title: "跨案例",
      content: "这次请求必须被拒绝。"
    })).rejects.toThrow("JOURNAL_PREVIEW_ENTRY_NOT_FOUND");
    await expect(service.readDay(
      "user-2",
      first.sessionId,
      editable.caseId,
      editable.entryDate
    )).rejects.toThrow("JOURNAL_PREVIEW_SESSION_NOT_FOUND");

    const edited = await service.updateRecord({
      userId: "user-1",
      sessionId: first.sessionId,
      caseId: editable.caseId,
      entryId: editable.eventEntryId,
      expectedContentRevision: 1,
      title: baseline.record.title,
      content: `${baseline.record.content}\n\n新的卡片内容。`
    });
    await service.saveRecord({
      userId: "user-1",
      sessionId: first.sessionId,
      caseId: editable.caseId,
      entryId: editable.eventEntryId,
      expectedContentRevision: edited.contentRevision
    });
    await expect(service.generateDaily({
      userId: "user-1",
      sessionId: first.sessionId,
      caseId: editable.caseId,
      task: "update",
      expectedSourceSignature: baseline.view.sourceSignature,
      expectedContentRevision: baseline.view.entry!.contentRevision
    })).rejects.toThrow("JOURNAL_PREVIEW_SOURCE_CHANGED");

    await expect(service.readDay(
      "user-1",
      second.sessionId,
      editable.caseId,
      editable.entryDate
    )).resolves.toMatchObject({ view: { displayStatus: "saved" } });
  });
});
