import {
  createPromptEnvelope,
  hashPromptContent
} from "@/features/ai-quality/prompt-manifest";

import type { JournalDailyWriterInput } from "./contract";

export const JOURNAL_DAILY_WRITER_PROMPT_V1_VERSION =
  "2026-08-10.journal-daily-record-synthesis-v1";

export const JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V1 = [
  "你负责把同一记录日期内的记录卡整理成第一人称今日日记。",
  "只允许使用输入 JSON 中的 currentRecords，以及 update 任务提供的 savedRevision。",
  "返回严格 JSON：{\"paragraphs\":[{\"text\":string,\"sourceRecordIds\":string[]}]}；不要返回 Markdown 代码块、标题或其他字段。",
  "每个段落必须有非空 text，并且 sourceRecordIds 只能引用 currentRecords 中真实存在的 recordId。",
  "generate 任务必须覆盖所有 currentRecords；update 任务必须覆盖 updatePlan.requiredSourceRecordIds。",
  "完整保留用户已经表达的事实、感受、认识、否定和不确定程度。",
  "同一事件的跨记录补充可以合并；关系不足的独立事件保持分开，不创造因果、转折或共同主题。",
  "保留用户清楚、有辨识度的词语、口语和情绪强度，只进行去重、排序和轻微顺句。",
  "update 中逐字保留 updatePlan.preservedParagraphs；不得恢复 updatePlan.intentionalDeletionSourceRecordIds。",
  "禁止新增事实、感受、原因、心理动机、建议、行动计划、跨事件洞察、共同主题和文学化环境描写。",
  "材料少时日记自然简短；材料多时优先完整覆盖，不以篇幅为由省略独立内容。"
].join("\n");

export const JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V1_HASH = hashPromptContent(
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V1
);

export const JOURNAL_DAILY_WRITER_PROMPT_V2_VERSION =
  "2026-08-11.journal-daily-natural-writing-v2";

export const JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2 = [
  "你负责把同一记录日期内的记录卡整理成一篇第一人称今日日记。",
  "只允许使用输入 JSON 中 currentRecords 的当前版本，以及 update 任务提供的 savedRevision；记录卡是日记唯一有效内容来源。",
  "返回严格 JSON：{\"paragraphs\":[{\"text\":string,\"sourceRecordIds\":string[]}]}；不要返回 Markdown 代码块、标题或其他字段。",
  "每个段落必须有非空 text，并且 sourceRecordIds 只能引用 currentRecords 中真实存在的 recordId。",
  "generate 任务必须覆盖所有 currentRecords；update 任务必须覆盖 updatePlan.requiredSourceRecordIds。",
  "把记录卡中的对话式表达转换成自然、连贯的书面日记，清理口头禅、重复表达和问答痕迹。",
  "完整表达每个独立事实、感受和当前有效认识；合并重复探索与同义内容，避免逐句拼接记录卡。",
  "有来源支持的认识要自然融入对应事件或结尾，让事实、感受与认识形成连续叙述。",
  "根据材料自主决定段落数量、段落长度、叙述节奏和自然衔接；程序不会规定固定段数或篇幅。",
  "同一事件的跨记录补充可以合并；关系不足的独立事件分别表达，不创造因果、转折或共同主题。",
  "保留否定、不确定性、真实情绪强度和有辨识度的用户语言；允许重组句序，并增加不改变事实的自然连接。",
  "update 中逐字保留 updatePlan.preservedParagraphs；不得恢复 updatePlan.intentionalDeletionSourceRecordIds。",
  "禁止新增事实、人物、时间、数字、原因、心理动机、建议、行动计划、跨事件洞察、共同主题和文学化扩写。",
  "材料少时日记自然简短；材料多时优先完整覆盖，不以篇幅为由省略独立内容。"
].join("\n");

export const JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2_HASH = hashPromptContent(
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2
);

export const JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION =
  "2026-08-11.journal-daily-contextual-writing-v3";

export const JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3 = [
  "你负责把同一记录日期内的记录卡整理成一篇第一人称今日日记。",
  "currentRecords.content 的当前版本是日记唯一有效事实边界；update 任务还必须逐字保护 savedRevision 与 updatePlan 中指定的用户内容。",
  "返回严格 JSON：{\"paragraphs\":[{\"text\":string,\"sourceRecordIds\":string[]}]}；不要返回 Markdown 代码块、标题或其他字段。",
  "每个段落必须有非空 text，并且 sourceRecordIds 只能引用 currentRecords 中真实存在的 recordId。",
  "generate 任务必须覆盖所有 currentRecords；update 任务必须覆盖 updatePlan.requiredSourceRecordIds。",
  "先识别 currentRecords 当前材料中真实存在的事件推进、感受变化或认识形成过程，再据此组织叙述主线；材料缺少共同主线时，按独立事件分别表达，禁止强行归纳共同主题。",
  "writingMaterial 已由程序绑定当前记录版本：eventText 负责事件与体验主干，supportedInsights 负责当前正文中已有的认识，questionContext 只负责理解用户回答所处的探索语境和叙述顺序；各层同一含义只表达一次。",
  "eventText 与 supportedInsights 仍受同一张记录卡 content 的事实边界约束。questionContext 不是事实、感受或认识来源；禁止复制、改写或在正文中提及其中的 AI 问题。",
  "把问答材料转换成连续的书面叙述。用户自身的自问只有在构成当天核心体验时才可保留，全文最多一次；questionContext 中的 AI 问题始终不得进入正文。",
  "把事件主干、感受和已有认识重新组织成自然、连续的日记叙述，清理口头禅、重复表达和问答痕迹，避免逐句拼接记录卡。",
  "有来源支持的认识要自然融入对应事件或结尾；同一含义只保留一次，避免整段照抄记录卡，避免连续句子使用相同开头。",
  "压缩连续出现的‘我觉得’，避免过密使用‘非常’‘特别’‘极其’等强烈措辞；表达强度以 currentRecords 中用户实际呈现的程度为准。",
  "根据材料自主决定段落数量、段落长度、叙述节奏和自然衔接；程序不会规定固定段数或篇幅。",
  "同一事件的跨记录补充可以合并；关系不足的独立事件分别表达，不创造因果、转折或共同主题。",
  "完整保留否定、不确定性与真实情绪强度；少量保留最有辨识度的用户原话，整体采用克制、自然的中文日记表达。允许重组句序，并增加不改变事实的自然连接。",
  "update 中逐字保留 updatePlan.preservedParagraphs；不得恢复 updatePlan.intentionalDeletionSourceRecordIds。",
  "禁止新增事实、人物、时间、数字、原因、心理动机、建议、行动计划、跨事件洞察、共同主题和文学化扩写。",
  "材料少时日记自然简短；材料多时优先完整覆盖，不以篇幅为由省略独立内容。"
].join("\n");

export const JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH = hashPromptContent(
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3
);

export const JOURNAL_DAILY_WRITER_PROMPT_VERSION =
  JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION;
export const JOURNAL_DAILY_WRITER_SYSTEM_PROMPT =
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3;
export const JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_HASH =
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH;

export const JOURNAL_DAILY_WRITER_CANDIDATE_MANIFEST = {
  manifestVersion: "2026-08-11.journal-daily-writer-candidates-v3",
  promptVersion: JOURNAL_DAILY_WRITER_PROMPT_VERSION,
  systemPromptHash: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_HASH,
  candidates: [
    { id: "flash", model: "deepseek-v4-flash" },
    { id: "pro", model: "deepseek-v4-pro" }
  ],
  thinking: "disabled" as const,
  temperature: 0.2,
  maxTechnicalRetries: 1,
  maxAttempts: 2,
  responseFormat: "json_object" as const,
  semanticValidator: {
    level: 3,
    enabledByDefault: false
  }
} as const;

export const JOURNAL_DAILY_WRITER_EXECUTION_CHECKLIST = [
  "freeze_source_signature_and_entry_revision",
  "reserve_generation_operation_and_trace",
  "write_strict_paragraph_json",
  "validate_non_empty_paragraphs_and_source_ids",
  "validate_required_source_coverage",
  "validate_saved_text_and_intentional_deletions_on_update",
  "commit_entry_revision_operation_and_trace_atomically",
  "record_failure_without_replacing_current_entry"
] as const;

function historicalSourceRecord(source: JournalDailyWriterInput["sourceRecords"][number]) {
  return {
    recordId: source.recordId,
    eventId: source.eventId,
    entryDate: source.entryDate,
    daySequence: source.daySequence,
    title: source.title,
    content: source.content,
    contentRevision: source.contentRevision,
    updatedAt: source.updatedAt
  };
}

function contextualSourceRecord(source: JournalDailyWriterInput["sourceRecords"][number]) {
  return {
    recordId: source.recordId,
    daySequence: source.daySequence,
    content: source.content,
    writingMaterial: source.writingMaterial
      ? {
          eventText: source.writingMaterial.eventText,
          supportedInsights: source.writingMaterial.supportedInsights,
          questionContext: source.writingMaterial.questionContext
        }
      : undefined
  };
}

function contextualSavedRevision(input: JournalDailyWriterInput) {
  return input.savedRevision
    ? {
        content: input.savedRevision.content,
        paragraphs: input.savedRevision.paragraphs
      }
    : null;
}

function buildPrompt(
  input: JournalDailyWriterInput,
  prompt: { version: string; content: string },
  options: { sourceContract: "historical" | "contextual" }
) {
  const userPayload = options.sourceContract === "contextual"
    ? {
        task: input.task,
        currentRecords: input.sourceRecords.map(contextualSourceRecord),
        savedRevision: contextualSavedRevision(input),
        updatePlan: input.updatePlan
      }
    : {
        task: input.task,
        entryDate: input.entryDate,
        deterministicTitle: input.title,
        currentRecords: input.sourceRecords.map(historicalSourceRecord),
        savedRevision: input.savedRevision,
        updatePlan: input.updatePlan
      };
  return createPromptEnvelope({
    promptKey: "journal.daily.write",
    promptVersion: prompt.version,
    messages: [
      { role: "system", content: prompt.content },
      {
        role: "user",
        content: JSON.stringify(userPayload)
      }
    ]
  });
}

/** 历史 GI-088 首轮复算专用；新链路不得调用。 */
export function buildJournalDailyWriterPromptV1(input: JournalDailyWriterInput) {
  return buildPrompt(input, {
    version: JOURNAL_DAILY_WRITER_PROMPT_V1_VERSION,
    content: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V1
  }, { sourceContract: "historical" });
}

/** 历史自然写作 v2 复算专用；输入合同不会携带 v3 writingMaterial。 */
export function buildJournalDailyWriterPromptV2(input: JournalDailyWriterInput) {
  return buildPrompt(input, {
    version: JOURNAL_DAILY_WRITER_PROMPT_V2_VERSION,
    content: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2
  }, { sourceContract: "historical" });
}

export function buildJournalDailyWriterPrompt(input: JournalDailyWriterInput) {
  return buildPrompt(input, {
    version: JOURNAL_DAILY_WRITER_PROMPT_VERSION,
    content: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT
  }, { sourceContract: "contextual" });
}
