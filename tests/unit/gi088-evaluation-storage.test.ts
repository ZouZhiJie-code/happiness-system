import { webcrypto } from "node:crypto";

import {
  GI088_OUTBOX_MAP_STORAGE_KEY,
  Gi088EvaluationStorageError,
  clearGi088EvaluationDraft,
  clearGi088EvaluationDraftsForRun,
  clearGi088EvaluationOutbox,
  clearGi088EvaluationOutboxesForRun,
  gi088EvaluationDraftStorageKey,
  listGi088EvaluationOutboxEntries,
  prepareGi088EvaluationOutbox,
  readGi088EvaluationDraft,
  readGi088EvaluationOutboxMap,
  writeGi088EvaluationDraft,
  type Gi088EvaluationDraftForm,
  type Gi088EvaluationDraftScope
} from "@/features/interview/event-centered/gi088-evaluation-storage";

const fixedNow = () => new Date("2026-08-10T12:00:00.000Z");

function draftScope(
  form: Gi088EvaluationDraftForm,
  overrides: Partial<Gi088EvaluationDraftScope> = {}
): Gi088EvaluationDraftScope {
  return {
    runId: "run-1",
    taskId: "A1",
    branch: "high",
    form,
    turnId: form === "question_review_note" ? "turn-1" : null,
    ...overrides
  };
}

describe("GI-088 evaluation local storage", () => {
  beforeAll(() => {
    if (!globalThis.crypto?.subtle) {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: webcrypto
      });
    }
  });

  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("按 run/task/branch/form/turn 独立保存五类草稿并精确清理", () => {
    const scopes = [
      draftScope("chat_input"),
      draftScope("question_review_note"),
      draftScope("trajectory_review"),
      draftScope("review_revision_reason"),
      draftScope("early_stop_reason", {
        taskId: null,
        branch: null,
        turnId: null
      })
    ] as const;
    const values = [
      "跟奶奶解释很累，但我还想继续聊。",
      "这轮只有一个回答焦点。",
      { feeling: "same", quality: "direct_use", reason: "承接自然" },
      "补充修订原因",
      "页面出现阻断，保留部分证据"
    ] as const;

    scopes.forEach((scope, index) => {
      expect(
        writeGi088EvaluationDraft(scope, values[index], {
          storage: window.sessionStorage,
          now: fixedNow
        })
      ).toBe(true);
    });

    scopes.forEach((scope, index) => {
      expect(
        readGi088EvaluationDraft(scope, window.sessionStorage)?.value
      ).toEqual(values[index]);
    });
    expect(new Set(scopes.map(gi088EvaluationDraftStorageKey)).size).toBe(5);

    expect(
      clearGi088EvaluationDraft(scopes[1], window.sessionStorage)
    ).toBe(true);
    expect(
      readGi088EvaluationDraft(scopes[1], window.sessionStorage)
    ).toBeNull();
    expect(
      readGi088EvaluationDraft(scopes[0], window.sessionStorage)?.value
    ).toBe(values[0]);
  });

  it("run 终态清理只移除该 run 的草稿", () => {
    const first = draftScope("chat_input");
    const second = draftScope("chat_input", { runId: "run-2" });
    writeGi088EvaluationDraft(first, "run-1 draft", {
      storage: window.sessionStorage,
      now: fixedNow
    });
    writeGi088EvaluationDraft(second, "run-2 draft", {
      storage: window.sessionStorage,
      now: fixedNow
    });

    expect(
      clearGi088EvaluationDraftsForRun("run-1", window.sessionStorage)
    ).toBe(1);
    expect(
      readGi088EvaluationDraft(first, window.sessionStorage)
    ).toBeNull();
    expect(
      readGi088EvaluationDraft(second, window.sessionStorage)?.value
    ).toBe("run-2 draft");
  });

  it("Map 型 outbox 同时保留不同任务与不同操作", async () => {
    const ids = ["turn-1", "turn-2", "turn-3"];
    const createId = () => ids.shift()!;
    const common = {
      runId: "run-1",
      branch: "high" as const,
      baseAssistantMessageId: "A1",
      confirmationFingerprint: "confirmed"
    };

    await prepareGi088EvaluationOutbox(
      {
        ...common,
        taskId: "A1",
        kind: "turn",
        content: "第一项对话"
      },
      { storage: window.sessionStorage, now: fixedNow, createId }
    );
    await prepareGi088EvaluationOutbox(
      {
        ...common,
        taskId: "A2",
        kind: "turn",
        content: "第二项对话"
      },
      { storage: window.sessionStorage, now: fixedNow, createId }
    );
    await prepareGi088EvaluationOutbox(
      {
        ...common,
        taskId: "A1",
        kind: "question_review",
        content: "复核说明"
      },
      { storage: window.sessionStorage, now: fixedNow, createId }
    );

    const entries = listGi088EvaluationOutboxEntries(window.sessionStorage);
    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.clientTurnId).sort()).toEqual([
      "turn-1",
      "turn-2",
      "turn-3"
    ]);
    expect(
      readGi088EvaluationOutboxMap(window.sessionStorage)
    ).toBeInstanceOf(Map);
  });

  it("同一逻辑提交复用 unresolved clientTurnId", async () => {
    const createId = vi.fn(() => "turn-stable");
    const input = {
      runId: "run-1",
      taskId: "A1",
      branch: "high" as const,
      kind: "turn" as const,
      baseAssistantMessageId: "A1",
      content: "  同一段正文  ",
      confirmationFingerprint: "confirmed"
    };
    const first = await prepareGi088EvaluationOutbox(input, {
      storage: window.sessionStorage,
      now: fixedNow,
      createId
    });
    const second = await prepareGi088EvaluationOutbox(
      { ...input, content: "同一段正文" },
      { storage: window.sessionStorage, now: fixedNow, createId }
    );

    expect(first.clientTurnId).toBe("turn-stable");
    expect(second.clientTurnId).toBe(first.clientTurnId);
    expect(second.contentHash).toBe(first.contentHash);
    expect(createId).toHaveBeenCalledTimes(1);
    expect(listGi088EvaluationOutboxEntries(window.sessionStorage)).toHaveLength(1);
  });

  it.each([
    ["正文变化", { content: "新正文" }],
    ["base anchor 变化", { baseAssistantMessageId: "A2" }],
    ["确认状态变化", { confirmationFingerprint: "reconfirmed" }]
  ])("%s 后在再次确认时生成新 ID，同时保留其他任务", async (_label, change) => {
    const ids = ["turn-old", "turn-other", "turn-new"];
    const dependencies = {
      storage: window.sessionStorage,
      now: fixedNow,
      createId: () => ids.shift()!
    };
    const base = {
      runId: "run-1",
      taskId: "A1",
      branch: "high" as const,
      kind: "turn" as const,
      baseAssistantMessageId: "A1",
      content: "原正文",
      confirmationFingerprint: "confirmed"
    };
    await prepareGi088EvaluationOutbox(base, dependencies);
    await prepareGi088EvaluationOutbox(
      { ...base, taskId: "A2", content: "其他任务" },
      dependencies
    );
    const replacement = await prepareGi088EvaluationOutbox(
      { ...base, ...change },
      dependencies
    );

    expect(replacement.clientTurnId).toBe("turn-new");
    const entries = listGi088EvaluationOutboxEntries(window.sessionStorage);
    expect(entries).toHaveLength(2);
    expect(entries.some((entry) => entry.clientTurnId === "turn-old")).toBe(false);
    expect(entries.some((entry) => entry.clientTurnId === "turn-other")).toBe(true);
  });

  it("按完整 outbox key 精确清理，run 清理不影响其他 run", async () => {
    const ids = ["turn-1", "turn-2"];
    const dependencies = {
      storage: window.sessionStorage,
      now: fixedNow,
      createId: () => ids.shift()!
    };
    const first = await prepareGi088EvaluationOutbox(
      {
        runId: "run-1",
        taskId: "A1",
        branch: "high",
        kind: "turn",
        baseAssistantMessageId: "A1",
        content: "run 1"
      },
      dependencies
    );
    await prepareGi088EvaluationOutbox(
      {
        runId: "run-2",
        taskId: "A1",
        branch: "high",
        kind: "turn",
        baseAssistantMessageId: "A1",
        content: "run 2"
      },
      dependencies
    );

    expect(clearGi088EvaluationOutbox(first, window.sessionStorage)).toBe(true);
    expect(listGi088EvaluationOutboxEntries(window.sessionStorage)).toHaveLength(1);
    expect(
      clearGi088EvaluationOutboxesForRun("run-2", window.sessionStorage)
    ).toBe(1);
    expect(listGi088EvaluationOutboxEntries(window.sessionStorage)).toHaveLength(0);
    expect(window.sessionStorage.getItem(GI088_OUTBOX_MAP_STORAGE_KEY)).toBeNull();
  });

  it("outbox 存储不可用时停止准备提交", async () => {
    await expect(
      prepareGi088EvaluationOutbox(
        {
          runId: "run-1",
          taskId: "A1",
          branch: "high",
          kind: "turn",
          baseAssistantMessageId: "A1",
          content: "需要可靠保存"
        },
        { storage: null }
      )
    ).rejects.toEqual(
      expect.objectContaining<Partial<Gi088EvaluationStorageError>>({
        code: "GI088_OUTBOX_UNAVAILABLE"
      })
    );
  });
});
