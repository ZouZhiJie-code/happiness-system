import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  JournalDailyEntrySnapshot,
  JournalDailyEntryWriter,
  JournalDailyGenerationStore,
  JournalDailyGenerationView,
  JournalDailySavedRevisionSnapshot,
  JournalDailySourceRecord
} from "@/server/services/journal-daily-entry/contract";
import {
  assessJournalDailyWriterOutput,
  buildJournalDailyUpdatePlan,
  createJournalDailyEntryGenerationService,
  deterministicJournalDailyEntryWriter,
  formatJournalDailyDateTitle
} from "@/server/services/journal-daily-entry/journal-daily-entry-generation.service";
import {
  buildJournalDailyWriterPrompt,
  buildJournalDailyWriterPromptV2,
  JOURNAL_DAILY_WRITER_CANDIDATE_MANIFEST,
  JOURNAL_DAILY_WRITER_PROMPT_VERSION,
  JOURNAL_DAILY_WRITER_PROMPT_V2_VERSION,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2_HASH,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_HASH
} from "@/server/services/journal-daily-entry/prompt";

const userId = "user-1";
const entryDate = "2026-08-10";

function source(
  recordId: string,
  contentRevision = 1,
  content = `记录 ${recordId}`
): JournalDailySourceRecord {
  return {
    recordId,
    eventId: `event-${recordId}`,
    entryDate,
    daySequence: Number(recordId.replace(/\D/gu, "")) || 1,
    title: `标题 ${recordId}`,
    content,
    contentRevision,
    updatedAt: "2026-08-10T10:00:00.000Z"
  };
}

function entry(overrides: Partial<JournalDailyEntrySnapshot> = {}): JournalDailyEntrySnapshot {
  return {
    id: "daily-1",
    entryDate,
    title: "2026年8月10日 周一",
    content: "用户保存的原句。",
    paragraphs: [{ text: "用户保存的原句。", sourceRecordIds: ["record-1"] }],
    status: "saved",
    sourceRecordIds: ["record-1"],
    sourceVersions: [{ recordId: "record-1", contentRevision: 1 }],
    sourceSignature: "v2|record-1:1",
    contentRevision: 1,
    savedRevision: 1,
    currentGenerationTraceId: null,
    lastGenerationErrorCode: null,
    ...overrides
  };
}

function savedRevision(
  overrides: Partial<JournalDailySavedRevisionSnapshot> = {}
): JournalDailySavedRevisionSnapshot {
  return {
    id: "revision-saved-1",
    entryId: "daily-1",
    title: "2026年8月10日 周一",
    content: "用户保存的原句。",
    paragraphs: [{ text: "用户保存的原句。", sourceRecordIds: ["record-1"] }],
    sourceVersions: [{ recordId: "record-1", contentRevision: 1 }],
    contentRevision: 1,
    ...overrides
  };
}

function setup(input: {
  view: JournalDailyGenerationView;
  saved?: JournalDailySavedRevisionSnapshot | null;
  writer?: JournalDailyEntryWriter;
}) {
  const read = vi.fn(async () => input.view);
  const readLatestSavedRevision = vi.fn(async () => input.saved ?? null);
  const reserve = vi.fn(async ({ task }: { task: "generate" | "update" }) => ({
    id: "generation-1",
    entryId: input.view.entry?.id ?? null,
    traceId: "trace-1",
    kind: task,
    status: "processing" as const,
    errorCode: null
  }));
  const commit = vi.fn(async (commitInput) => ({
    ...(input.view.entry ?? entry({
      status: "draft",
      contentRevision: 0,
      savedRevision: null,
      paragraphs: [],
      content: "",
      sourceRecordIds: [],
      sourceVersions: []
    })),
    title: commitInput.title,
    content: commitInput.content,
    paragraphs: commitInput.paragraphs,
    sourceRecordIds: input.view.sourceRecords.map((item) => item.recordId),
    sourceVersions: input.view.sourceRecords.map((item) => ({
      recordId: item.recordId,
      contentRevision: item.contentRevision
    })),
    sourceSignature: input.view.sourceSignature,
    contentRevision: (input.view.entry?.contentRevision ?? 0) + 1,
    currentGenerationTraceId: commitInput.generationTraceId
  }));
  const fail = vi.fn(async () => undefined);
  const store = {
    read,
    readLatestSavedRevision,
    reserve,
    commit,
    fail
  } as JournalDailyGenerationStore;
  const service = createJournalDailyEntryGenerationService({
    store,
    writer: input.writer ?? deterministicJournalDailyEntryWriter
  });
  return { service, read, readLatestSavedRevision, reserve, commit, fail };
}

describe("journal daily entry generation service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses a deterministic compact date title and rejects impossible dates", () => {
    expect(formatJournalDailyDateTitle("2026-08-10")).toBe("2026年8月10日 周一");
    expect(() => formatJournalDailyDateTitle("2026-02-30")).toThrow(
      "JOURNAL_DAILY_INVALID_DATE"
    );
  });

  it("freezes a versioned prompt and execution manifest without invoking a provider", () => {
    const contextualSource = {
      ...source("record-1"),
      writingMaterial: {
        eventText: "记录 record-1",
        supportedInsights: [],
        questionContext: [{
          answerSourceMessageId: "answer-1",
          question: "当时最明显的感受是什么？"
        }],
        basedOnContentRevision: 1
      }
    };
    const prompt = buildJournalDailyWriterPrompt({
      task: "generate",
      entryDate,
      title: "2026年8月10日 周一",
      sourceRecords: [contextualSource],
      currentEntry: null,
      savedRevision: null,
      updatePlan: null
    });

    expect(prompt.promptVersion).toBe(JOURNAL_DAILY_WRITER_PROMPT_VERSION);
    expect(prompt.promptVersion).toBe("2026-08-11.journal-daily-contextual-writing-v3");
    expect(prompt.resolvedPromptHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_HASH).toBe(
      "0c1bc273abfcfbdb3fae283f912be67eb79c04016e5b77a7e49ec1b410013e8a"
    );
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("返回严格 JSON");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("保留否定、不确定性");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("清理口头禅、重复表达和问答痕迹");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("自主决定段落数量");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("禁止新增事实");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("先识别 currentRecords 当前材料中真实存在的");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("eventText 负责事件与体验主干");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("各层同一含义只表达一次");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("把问答材料转换成连续的书面叙述");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("用户自身的自问只有在构成当天核心体验时才可保留，全文最多一次");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("questionContext 中的 AI 问题始终不得进入正文");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("压缩连续出现的‘我觉得’");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("避免过密使用‘非常’‘特别’‘极其’等强烈措辞");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("少量保留最有辨识度的用户原话");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT).toContain("整体采用克制、自然的中文日记表达");
    expect(prompt.messages).toHaveLength(2);
    expect(prompt.messages.map((message) => message.role)).toEqual(["system", "user"]);
    const v3Payload = JSON.parse(String(prompt.messages.at(-1)?.content));
    expect(v3Payload).not.toHaveProperty("entryDate");
    expect(v3Payload).not.toHaveProperty("deterministicTitle");
    expect(v3Payload.currentRecords[0]).toEqual({
      recordId: "record-1",
      daySequence: 1,
      content: "记录 record-1",
      writingMaterial: {
        eventText: "记录 record-1",
        supportedInsights: [],
        questionContext: [{
          answerSourceMessageId: "answer-1",
          question: "当时最明显的感受是什么？"
        }]
      }
    });
    for (const hiddenField of [
      "title",
      "eventId",
      "entryDate",
      "updatedAt",
      "contentRevision"
    ]) {
      expect(v3Payload.currentRecords[0]).not.toHaveProperty(hiddenField);
    }
    expect(v3Payload.currentRecords[0].writingMaterial)
      .not.toHaveProperty("basedOnContentRevision");

    const updatePrompt = buildJournalDailyWriterPrompt({
      task: "update",
      entryDate,
      title: "2026年8月10日 周一",
      sourceRecords: [contextualSource],
      currentEntry: entry(),
      savedRevision: savedRevision(),
      updatePlan: {
        requiredSourceRecordIds: ["record-1"],
        newSourceRecordIds: [],
        changedSourceRecordIds: [],
        intentionalDeletionSourceRecordIds: [],
        preservedParagraphs: [{ text: "用户保存的原句。", sourceRecordIds: ["record-1"] }]
      }
    });
    const updatePayload = JSON.parse(String(updatePrompt.messages.at(-1)?.content));
    expect(updatePayload.savedRevision).toEqual({
      content: "用户保存的原句。",
      paragraphs: [{ text: "用户保存的原句。", sourceRecordIds: ["record-1"] }]
    });
    for (const hiddenField of ["id", "entryId", "title", "sourceVersions", "contentRevision"]) {
      expect(updatePayload.savedRevision).not.toHaveProperty(hiddenField);
    }

    const v2Prompt = buildJournalDailyWriterPromptV2({
      task: "generate",
      entryDate,
      title: "2026年8月10日 周一",
      sourceRecords: [contextualSource],
      currentEntry: null,
      savedRevision: null,
      updatePlan: null
    });
    expect(v2Prompt.promptVersion).toBe(JOURNAL_DAILY_WRITER_PROMPT_V2_VERSION);
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2).toContain("自然、连贯的书面日记");
    expect(JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2_HASH).toMatch(/^[a-f0-9]{64}$/u);
    const v2Payload = JSON.parse(String(v2Prompt.messages.at(-1)?.content));
    expect(v2Payload.entryDate).toBe(entryDate);
    expect(v2Payload.deterministicTitle).toBe("2026年8月10日 周一");
    expect(v2Payload.currentRecords[0]).toMatchObject({
      eventId: "event-record-1",
      entryDate,
      title: "标题 record-1",
      contentRevision: 1,
      updatedAt: "2026-08-10T10:00:00.000Z"
    });
    expect(v2Payload.currentRecords[0]).not.toHaveProperty("writingMaterial");
    expect(JOURNAL_DAILY_WRITER_CANDIDATE_MANIFEST).toMatchObject({
      candidates: [
        { model: "deepseek-v4-flash" },
        { model: "deepseek-v4-pro" }
      ],
      thinking: "disabled",
      temperature: 0.2,
      maxTechnicalRetries: 1,
      semanticValidator: { enabledByDefault: false }
    });
  });

  it("reports writing diagnostics without turning them into a P0 rejection", () => {
    const records: JournalDailySourceRecord[] = [
      {
        ...source("record-1", 1, "上午忘带电脑，我到公司后有点慌。"),
        writingMaterial: {
          eventText: "上午忘带电脑，我到公司后有点慌。",
          supportedInsights: [],
          questionContext: [],
          basedOnContentRevision: 1
        }
      },
      {
        ...source("record-2", 1, "后来我慢慢把事情重新排好了。"),
        writingMaterial: {
          eventText: "后来我慢慢把事情重新排好了。",
          supportedInsights: [],
          questionContext: [{
            answerSourceMessageId: "answer-2",
            question: "当时最明显的感受是什么？"
          }],
          basedOnContentRevision: 1
        }
      }
    ];
    const gate = assessJournalDailyWriterOutput({
      output: {
        paragraphs: [
          {
            text: "上午的记录里，上午忘带电脑，我到公司后有点慌。后来才缓过来。",
            sourceRecordIds: ["record-1"]
          },
          {
            text: "我回答这个问题时，又写下：当时最明显的感受是什么？今天回想还是有点乱。今天回想也看见自己缓了下来。",
            sourceRecordIds: ["record-2"]
          }
        ]
      },
      sourceRecords: records,
      task: "generate",
      updatePlan: null
    });

    expect(gate.accepted).toBe(true);
    expect(gate.issues).toEqual([]);
    expect(gate.diagnostics).toEqual(expect.arrayContaining([
      "CONTEXT_QUESTION_LEAKED",
      "QUESTION_ANSWER_TRACE_PRESENT",
      "SOURCE_RECORD_VERBATIM_COPY",
      "REPEATED_SENTENCE_OPENING"
    ]));
  });

  it("generates from one current record, validates full coverage, and commits atomically", async () => {
    const writer = {
      outputOrigin: "deterministic" as const,
      write: vi.fn(async () => ({
        paragraphs: [{ text: "今天下雨，我在便利店等了一会儿。", sourceRecordIds: ["record-1"] }]
      }))
    };
    const harness = setup({
      view: {
        entryDate,
        sourceRecords: [source("record-1", 1, "今天下雨，我在便利店等了一会儿。")],
        sourceSignature: "v2|record-1:1",
        entry: null
      },
      writer
    });

    const result = await harness.service.generate({
      userId,
      entryDate,
      clientOperationId: "operation-1",
      expectedSourceSignature: "v2|record-1:1",
      expectedContentRevision: null
    });

    expect(result).toMatchObject({
      task: "generate",
      title: "2026年8月10日 周一",
      generationId: "generation-1",
      generationTraceId: "trace-1"
    });
    expect(harness.reserve).toHaveBeenCalledWith(expect.objectContaining({
      task: "generate",
      clientOperationId: "operation-1",
      expectedContentRevision: null
    }));
    expect(harness.commit).toHaveBeenCalledWith(expect.objectContaining({
      revisionKind: "generated",
      generationId: "generation-1",
      content: "今天下雨，我在便利店等了一会儿。",
      paragraphs: [{
        text: "今天下雨，我在便利店等了一会儿。",
        sourceRecordIds: ["record-1"]
      }],
      pipelineDecisions: expect.arrayContaining([
        expect.objectContaining({
          kind: "journal_daily_quality_gate",
          accepted: true,
          diagnostics: ["SOURCE_RECORD_VERBATIM_COPY"]
        })
      ])
    }));
    expect(harness.fail).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "unknown source id",
      output: { paragraphs: [{ text: "正文", sourceRecordIds: ["unknown"] }] },
      issue: "SOURCE_RECORD_ID_UNKNOWN:0:unknown"
    },
    {
      name: "empty paragraph",
      output: { paragraphs: [{ text: "   ", sourceRecordIds: ["record-1"] }] },
      issue: "EMPTY_PARAGRAPH:0"
    },
    {
      name: "incomplete coverage",
      output: { paragraphs: [{ text: "只写第一条", sourceRecordIds: ["record-1"] }] },
      issue: "SOURCE_RECORD_UNCOVERED:record-2"
    }
  ])("rejects $name and keeps the current entry untouched", async ({ output, issue }) => {
    const writer = { write: vi.fn(async () => output) };
    const harness = setup({
      view: {
        entryDate,
        sourceRecords: [source("record-1"), source("record-2")],
        sourceSignature: "v2|records",
        entry: null
      },
      writer
    });

    await expect(harness.service.generate({ userId, entryDate }))
      .rejects.toMatchObject({
        code: "JOURNAL_DAILY_QUALITY_GATE_FAILED",
        issues: expect.arrayContaining([issue])
      });
    expect(harness.commit).not.toHaveBeenCalled();
    expect(harness.fail).toHaveBeenCalledWith({
      userId,
      generationId: "generation-1",
      errorCode: "JOURNAL_DAILY_QUALITY_GATE_FAILED"
    });
  });

  it("preserves unchanged saved text, keeps intentional deletions out, and covers new records", async () => {
    const currentEntry = entry({
      sourceRecordIds: ["record-1", "record-2"],
      sourceVersions: [
        { recordId: "record-1", contentRevision: 1 },
        { recordId: "record-2", contentRevision: 1 }
      ]
    });
    const saved = savedRevision({
      paragraphs: [{ text: "这是我自己保存的写法。", sourceRecordIds: ["record-1"] }],
      content: "这是我自己保存的写法。",
      sourceVersions: [
        { recordId: "record-1", contentRevision: 1 },
        { recordId: "record-2", contentRevision: 1 }
      ]
    });
    const records = [source("record-1"), source("record-2"), source("record-3")];
    const plan = buildJournalDailyUpdatePlan({ sourceRecords: records, savedRevision: saved });
    expect(plan).toMatchObject({
      requiredSourceRecordIds: ["record-1", "record-3"],
      newSourceRecordIds: ["record-3"],
      intentionalDeletionSourceRecordIds: ["record-2"],
      preservedParagraphs: [{ text: "这是我自己保存的写法。", sourceRecordIds: ["record-1"] }]
    });
    const harness = setup({
      view: {
        entryDate,
        sourceRecords: records,
        sourceSignature: "v2|three-records",
        entry: currentEntry
      },
      saved
    });

    const result = await harness.service.update({ userId, entryDate });

    expect(result.paragraphs).toEqual([
      { text: "这是我自己保存的写法。", sourceRecordIds: ["record-1"] },
      { text: "记录 record-3", sourceRecordIds: ["record-3"] }
    ]);
    expect(result.paragraphs.flatMap((paragraph) => paragraph.sourceRecordIds))
      .not.toContain("record-2");
    expect(harness.commit).toHaveBeenCalledWith(expect.objectContaining({
      revisionKind: "updated",
      expectedContentRevision: 1
    }));
  });

  it("preserves a saved user-authored paragraph without inventing a record source", async () => {
    const saved = savedRevision({
      content: "记录段落。\n\n我自己补的一句。",
      paragraphs: [
        { text: "记录段落。", sourceRecordIds: ["record-1"] },
        { text: "我自己补的一句。", sourceRecordIds: [] }
      ]
    });
    const harness = setup({
      view: {
        entryDate,
        sourceRecords: [source("record-1"), source("record-2")],
        sourceSignature: "v2|manual-paragraph",
        entry: entry()
      },
      saved
    });

    const result = await harness.service.update({ userId, entryDate });

    expect(result.paragraphs).toContainEqual({
      text: "我自己补的一句。",
      sourceRecordIds: []
    });
  });

  it("preserves the current manual paragraph when records changed after the last save", async () => {
    const currentEntry = entry({
      contentRevision: 2,
      savedRevision: 1,
      content: "旧记录段落。\n\n我想保留的人工补充。",
      paragraphs: [
        { text: "旧记录段落。", sourceRecordIds: ["record-1"] },
        { text: "我想保留的人工补充。", sourceRecordIds: [] }
      ],
      sourceVersions: [{ recordId: "record-1", contentRevision: 1 }]
    });
    const harness = setup({
      view: {
        entryDate,
        sourceRecords: [source("record-1", 2, "记录已经更新。")],
        sourceSignature: "v2|updated-record",
        entry: currentEntry
      },
      saved: savedRevision({
        contentRevision: 1,
        content: "旧记录段落。",
        paragraphs: [{ text: "旧记录段落。", sourceRecordIds: ["record-1"] }],
        sourceVersions: [{ recordId: "record-1", contentRevision: 1 }]
      })
    });

    const result = await harness.service.update({ userId, entryDate });

    expect(result.paragraphs).toEqual([
      { text: "我想保留的人工补充。", sourceRecordIds: [] },
      { text: "记录已经更新。", sourceRecordIds: ["record-1"] }
    ]);
  });

  it("requires a previously deleted record again when that record has changed", () => {
    const plan = buildJournalDailyUpdatePlan({
      sourceRecords: [source("record-1"), source("record-2", 2, "第二条已经更新")],
      savedRevision: savedRevision({
        paragraphs: [{ text: "只保留第一条", sourceRecordIds: ["record-1"] }],
        sourceVersions: [
          { recordId: "record-1", contentRevision: 1 },
          { recordId: "record-2", contentRevision: 1 }
        ]
      })
    });
    expect(plan.changedSourceRecordIds).toEqual(["record-2"]);
    expect(plan.intentionalDeletionSourceRecordIds).toEqual([]);
    expect(plan.requiredSourceRecordIds).toEqual(["record-1", "record-2"]);
  });

  it("blocks rewriting an unaffected saved paragraph and resurrecting an unchanged deletion", async () => {
    const saved = savedRevision({
      content: "用户坚持保留的原句。",
      paragraphs: [{ text: "用户坚持保留的原句。", sourceRecordIds: ["record-1"] }],
      sourceVersions: [
        { recordId: "record-1", contentRevision: 1 },
        { recordId: "record-2", contentRevision: 1 }
      ]
    });
    const writer = {
      write: vi.fn(async () => ({
        paragraphs: [
          { text: "模型改写了用户保存的原句。", sourceRecordIds: ["record-1"] },
          { text: "模型恢复了用户删掉的第二条。", sourceRecordIds: ["record-2"] },
          { text: "新增第三条。", sourceRecordIds: ["record-3"] }
        ]
      }))
    };
    const harness = setup({
      view: {
        entryDate,
        sourceRecords: [source("record-1"), source("record-2"), source("record-3")],
        sourceSignature: "v2|three-records",
        entry: entry({
          sourceRecordIds: ["record-1", "record-2"],
          sourceVersions: saved.sourceVersions
        })
      },
      saved,
      writer
    });

    await expect(harness.service.update({ userId, entryDate }))
      .rejects.toMatchObject({
        code: "JOURNAL_DAILY_QUALITY_GATE_FAILED",
        issues: expect.arrayContaining([
          "SAVED_PARAGRAPH_NOT_PRESERVED:0",
          "INTENTIONAL_DELETION_RESURRECTED:record-2"
        ])
      });
    expect(harness.commit).not.toHaveBeenCalled();
  });

  it("falls back to the current generated revision when a draft has never been saved", async () => {
    const draftEntry = entry({
      status: "draft",
      savedRevision: null,
      content: "原始生成草稿。",
      paragraphs: [{ text: "原始生成草稿。", sourceRecordIds: ["record-1"] }]
    });
    const harness = setup({
      view: {
        entryDate,
        sourceRecords: [source("record-1"), source("record-2")],
        sourceSignature: "v2|draft-update",
        entry: draftEntry
      },
      saved: null
    });

    const result = await harness.service.update({ userId, entryDate });

    expect(result.paragraphs).toEqual([
      { text: "原始生成草稿。", sourceRecordIds: ["record-1"] },
      { text: "记录 record-2", sourceRecordIds: ["record-2"] }
    ]);
    expect(harness.reserve).toHaveBeenCalledWith(expect.objectContaining({ task: "update" }));
  });

  it("rejects stale UI versions before reserving an operation", async () => {
    const harness = setup({
      view: {
        entryDate,
        sourceRecords: [source("record-1")],
        sourceSignature: "v2|current",
        entry: null
      }
    });

    await expect(harness.service.generate({
      userId,
      entryDate,
      expectedSourceSignature: "v2|stale",
      expectedContentRevision: null
    })).rejects.toMatchObject({ code: "JOURNAL_DAILY_SOURCE_CHANGED" });
    expect(harness.reserve).not.toHaveBeenCalled();
  });

  it("records writer failure while preserving the existing entry", async () => {
    const currentEntry = entry();
    const harness = setup({
      view: {
        entryDate,
        sourceRecords: [source("record-1"), source("record-2")],
        sourceSignature: "v2|update",
        entry: currentEntry
      },
      saved: savedRevision(),
      writer: { write: vi.fn(async () => { throw new Error("writer unavailable"); }) }
    });

    await expect(harness.service.update({ userId, entryDate }))
      .rejects.toMatchObject({ code: "JOURNAL_DAILY_WRITER_FAILED" });
    expect(harness.commit).not.toHaveBeenCalled();
    expect(currentEntry.content).toBe("用户保存的原句。");
    expect(harness.fail).toHaveBeenCalledWith({
      userId,
      generationId: "generation-1",
      errorCode: "JOURNAL_DAILY_WRITER_FAILED"
    });
  });
});
