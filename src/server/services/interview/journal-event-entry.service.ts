import { z } from "zod";

import { createPromptEnvelope } from "@/features/ai-quality/prompt-manifest";
import { assertEventCenteredWriteAllowed } from "@/features/interview/event-centered-release";
import {
  completeJournalEventEntryGeneration,
  failJournalEventEntryGeneration,
  getJournalEventEntryForUser,
  reserveJournalEventEntryGeneration,
  saveJournalEventEntry,
  updateJournalEventEntry
} from "@/server/repositories/journal-event-entry.repository";
import { recordAIInvocation } from "@/server/repositories/ai-quality.repository";
import {
  getEventCenteredAIProvider,
  readEventCenteredGenerativeModel
} from "@/server/services/ai/event-centered-provider";
import { completeStructuredOutput, type StructuredOutputAttempt } from "@/server/services/ai/structured-output";
import { recordEventCenteredAnalyticsEvent } from "@/server/services/interview/event-centered-analytics.service";
import { getEventCenteredInterviewWorkspace } from "@/server/services/interview/event-centered-interview.service";
import type {
  JournalEventEntryGenerationRecord,
  JournalEventEntryRecord,
  JournalEventEntrySourceSnapshot,
  SaveJournalEventEntryInput,
  UpdateJournalEventEntryInput
} from "@/types/journal-event-entry";

export const EVENT_JOURNAL_PROMPT_VERSION =
  "2026-08-03.event-journal-source-refs-v3-gi059-compact";
const EVENT_JOURNAL_AI_TIMEOUT_MS = 30_000;
const EVENT_JOURNAL_AI_MAX_ATTEMPTS = 3;

export const eventJournalDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(16),
    content: z.string().trim().min(1).max(5000)
  })
  .strict();

type EventJournalDraft = z.infer<typeof eventJournalDraftSchema>;

const eventJournalSourceRefSchema = z.string().trim().min(1).max(120);

export const eventJournalStructuredDraftSchema = z
  .object({
    title: z
      .object({
        text: z.string().trim().min(1).max(16),
        sourceRefs: z.array(eventJournalSourceRefSchema).max(6)
      })
      .strict(),
    blocks: z
      .array(
        z
          .object({
            kind: z.enum(["event", "insight"]),
            text: z.string().trim().min(1).max(2_000),
            sourceRefs: z.array(eventJournalSourceRefSchema).max(8)
          })
          .strict()
      )
      .min(1)
      .max(8)
  })
  .strict();

type EventJournalStructuredDraft = z.infer<typeof eventJournalStructuredDraftSchema>;
type EventJournalProviderDraft = EventJournalStructuredDraft | EventJournalDraft;

type EventJournalSource = {
  ref: string;
  text: string;
  kind: "message" | "fact" | "outcome";
};

type EventJournalSourceProtocolGate = {
  accepted: boolean;
  issues: string[];
  titleIssues: string[];
  bodyIssues: string[];
  titleRepaired: boolean;
  fullFallbackRequired: boolean;
  sourceRefsUsed: boolean;
};

type EventJournalGroundingGate = {
  accepted: boolean;
  issues: string[];
};

export type GenerateJournalEventEntryInput = {
  userId: string;
  rootSessionId: string;
  baseBranchSessionId: string;
  baseMessageSequence: number;
  clientOperationId: string;
  requestId?: string | null;
};

export type GenerateJournalEventEntryResult = {
  entry: JournalEventEntryRecord;
  workspace: NonNullable<Awaited<ReturnType<typeof getEventCenteredInterviewWorkspace>>>;
  generation: {
    origin: "llm" | "fallback" | "existing";
    attemptCount: number;
    latencyMs: number;
  };
};

function compactSource(snapshot: JournalEventEntrySourceSnapshot) {
  const effectiveFactIds = new Set(snapshot.effectiveFactIds);
  const eligibleOutcomeIds = new Set(snapshot.logEligibleOutcomeIds);
  return {
    userMessages: snapshot.messages
      .filter((message) => message.role === "user")
      .map((message) => ({ id: message.id, text: message.content.trim() }))
      .filter((message) => message.text),
    facts: snapshot.facts
      .filter((fact) => effectiveFactIds.has(fact.id) && fact.stance === "affirmed")
      .map((fact) => ({
        id: fact.id,
        statement: fact.statement,
        scope: fact.scope,
        kind: fact.kind
      })),
    insights: snapshot.angleOutcomes
      .filter((outcome) => eligibleOutcomeIds.has(outcome.id) && outcome.kind === "insight")
      .map((outcome) => ({ id: outcome.id, angle: outcome.angle, statement: outcome.statement }))
  };
}

function eventJournalSourceCatalog(snapshot: JournalEventEntrySourceSnapshot): EventJournalSource[] {
  const source = compactSource(snapshot);
  return [
    ...source.userMessages.map((message) => ({
      ref: `message:${message.id}`,
      text: message.text,
      kind: "message" as const
    })),
    ...source.facts.map((fact) => ({
      ref: `fact:${fact.id}`,
      text: fact.statement,
      kind: "fact" as const
    })),
    ...source.insights.map((insight) => ({
      ref: `outcome:${insight.id}`,
      text: insight.statement,
      kind: "outcome" as const
    }))
  ].filter((item) => item.text.trim());
}

function sourceRefsForText(text: string, sources: EventJournalSource[]) {
  const normalizedText = normalizeGroundingText(text);
  if (!normalizedText) return [];
  const textGrams = [...groundingBigrams(text)];
  return sources
    .map((source) => {
      const normalizedSource = normalizeGroundingText(source.text);
      const overlap = textGrams.filter((gram) => normalizedSource.includes(gram)).length;
      const exact = normalizedSource.includes(normalizedText);
      return { source, score: exact ? 10_000 : overlap };
    })
    .filter(({ score }) => score >= (textGrams.length <= 2 ? 1 : Math.max(2, Math.ceil(textGrams.length * 0.25))))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ source }) => source.ref);
}

function compileEventJournalProviderDraft(
  providerDraft: EventJournalProviderDraft,
  snapshot: JournalEventEntrySourceSnapshot
): { draft: EventJournalDraft; structured: EventJournalStructuredDraft } {
  const sources = eventJournalSourceCatalog(snapshot);
  if ("blocks" in providerDraft) {
    const structuredDraft = providerDraft;
    const blocks = structuredDraft.blocks;
    const eventBlocks = blocks.filter((block) => block.kind === "event");
    const insightBlocks = blocks.filter((block) => block.kind === "insight");
    const content = [
      ...eventBlocks.map((block) => block.text),
      ...(insightBlocks.length > 0
        ? ["我看见的", ...insightBlocks.map((block) => block.text)]
        : [])
    ].join("\n\n");
    return {
      draft: { title: structuredDraft.title.text, content },
      structured: structuredDraft
    };
  }

  const blocks: EventJournalStructuredDraft["blocks"] = [{
    kind: "event",
    text: providerDraft.content,
    sourceRefs: sourceRefsForText(providerDraft.content, sources)
  }];
  return {
    draft: providerDraft,
    structured: {
      title: {
        text: providerDraft.title,
        sourceRefs: sourceRefsForText(providerDraft.title, sources)
      },
      blocks
    }
  };
}

export function buildEventJournalPrompt(snapshot: JournalEventEntrySourceSnapshot) {
  const source = compactSource(snapshot);
  const seenSourceTexts = new Set<string>();
  const promptSources = [
    ...source.userMessages.map((message) => ({
      ref: `message:${message.id}`,
      text: message.text
    })),
    ...source.insights.map((insight) => ({
      ref: `outcome:${insight.id}`,
      text: insight.statement
    })),
    ...source.facts.map((fact) => ({
      ref: `fact:${fact.id}`,
      text: fact.statement
    }))
  ].filter((item) => {
    const normalized = item.text.replace(/\s+/gu, "").trim();
    if (!normalized || seenSourceTexts.has(normalized)) return false;
    seenSourceTexts.add(normalized);
    return true;
  });
  return createPromptEnvelope({
    promptKey: "interview.journal.event",
    promptVersion: EVENT_JOURNAL_PROMPT_VERSION,
    messages: [
      {
        role: "system",
        content: [
          "你把一件事整理成用户自己的中文日志。只允许使用输入 JSON 中提供的用户原话、有效事实和可写入日志的认识。",
          "返回严格 JSON：{\"title\":{\"text\":string,\"sourceRefs\":string[]},\"blocks\":[{\"kind\":\"event\"|\"insight\",\"text\":string,\"sourceRefs\":string[]}]}。标题不超过16个字。",
          "每个 sourceRefs 只能填写来源目录中的编号；标题和每个正文 block 至少绑定一条真实来源。不要输出来源目录之外的编号。",
          "正文采用第一人称、自然叙事。先写完整事件；存在 insights 时，再以“我看见的”为自然小标题写已有认识。",
          "保持并存的事实和限定，避免把它们改成排他关系。",
          "禁止新增对话、情绪、原因、动机、结果、建议、人格判断、长期规律和抽象升华。",
          "材料有限时只整理发生了什么，不补洞见。来源编号只供系统校验，用户可见文本中不要写出编号和角度名。"
        ].join("\n")
      },
      {
        role: "user",
        content: `请依据以下唯一来源目录生成事件日志：\n${JSON.stringify(promptSources)}`
      }
    ]
  });
}

function normalizeSentence(value: string) {
  return value.replace(/\s+/gu, " ").trim().replace(/[。！？!?；;]+$/u, "");
}

function uniqueSentences(values: string[]) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const sentence = normalizeSentence(value);
    if (!sentence || seen.has(sentence)) return [];
    seen.add(sentence);
    return [sentence];
  });
}

function normalizeGroundingText(value: string) {
  return value
    .replace(/\s+/gu, "")
    .replace(/[，。！？、；：“”‘’'"（）()《》【】\[\]—…,.!?;:\-]/gu, "")
    .trim();
}

function groundingBigrams(value: string) {
  const normalized = normalizeGroundingText(value);
  const grams = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const gram = normalized.slice(index, index + 2);
    if (!/^[的是了我在有和与也就这那把被让给对从为而]+$/u.test(gram)) grams.add(gram);
  }
  return grams;
}

/**
 * 首发质量门只验证可客观确定的来源覆盖：每一段都要能落回冻结来源，
 * 新出现的数字和引号内容也必须来自来源。语义是否自然继续进入人工与线上评审。
 */
export function assessEventJournalDraftGrounding(
  snapshot: JournalEventEntrySourceSnapshot,
  draft: EventJournalDraft
): EventJournalGroundingGate {
  const source = compactSource(snapshot);
  const sourceTexts = [
    ...source.userMessages.map((message) => message.text),
    ...source.facts.map((fact) => fact.statement),
    ...source.insights.map((insight) => insight.statement)
  ].filter(Boolean);
  const normalizedSource = normalizeGroundingText(sourceTexts.join("\n"));
  if (!normalizedSource) return { accepted: false, issues: ["missing_event_journal_source"] };

  const sourceGrams = new Set(sourceTexts.flatMap((text) => [...groundingBigrams(text)]));
  const contentUnits = draft.content
    .split(/[\n，。！？；,.!?;]+/u)
    .map((unit) => unit.trim())
    .filter((unit) => unit && unit !== "我看见的");
  const issues: string[] = [];

  const hasSourceCoverage = (value: string) => {
    const normalizedValue = normalizeGroundingText(value);
    if (!normalizedValue) return true;
    if (sourceTexts.some((text) => normalizeGroundingText(text).includes(normalizedValue))) return true;
    const valueGrams = [...groundingBigrams(value)];
    const overlap = valueGrams.filter((gram) => sourceGrams.has(gram)).length;
    const required = valueGrams.length <= 2
      ? 1
      : Math.max(2, Math.ceil(valueGrams.length * 0.65));
    return overlap >= required;
  };

  if (!hasSourceCoverage(draft.title)) issues.push("title_without_source_anchor");

  for (const unit of contentUnits) {
    if (!hasSourceCoverage(unit)) issues.push("paragraph_without_source_anchor");
  }

  const visibleDraft = `${draft.title}\n${draft.content}`;
  const outputNumbers = visibleDraft.match(/\d+(?:\.\d+)?/gu) ?? [];
  if (outputNumbers.some((number) => !normalizedSource.includes(number))) {
    issues.push("unverified_number");
  }
  const quotedClaims = [...visibleDraft.matchAll(/[“"]([^”"]{2,80})[”"]/gu)]
    .map((match) => normalizeGroundingText(match[1] ?? ""))
    .filter(Boolean);
  if (quotedClaims.some((claim) => !normalizedSource.includes(claim))) {
    issues.push("unverified_quote");
  }

  return { accepted: issues.length === 0, issues: [...new Set(issues)] };
}

function sourceProtocolSafetyIssues(value: string, sources: EventJournalSource[]) {
  const sourceText = sources.map((source) => source.text).join("\n");
  const issues: string[] = [];
  const outputNumbers = value.match(/\d+(?:\.\d+)?/gu) ?? [];
  if (outputNumbers.some((number) => !sourceText.includes(number))) {
    issues.push("unverified_number");
  }
  const quotedClaims = [...value.matchAll(/[“"]([^”"]{2,80})[”"]/gu)]
    .map((match) => normalizeGroundingText(match[1] ?? ""))
    .filter(Boolean);
  if (quotedClaims.some((claim) => !normalizeGroundingText(sourceText).includes(claim))) {
    issues.push("unverified_quote");
  }

  const tokenGroups: Array<[string, RegExp]> = [
    ["unverified_person", /(?:对方|他|她|他们|同事|朋友|家人|对象|伴侣|男朋友|女朋友|妻子|丈夫|老板|领导|孩子|妈妈|爸爸|母亲|父亲|医生|老师|同学|宠物|狗|猫)/gu],
    ["unverified_action", /(?:决定|辞职|购买|买了|打电话|发送|答应|承诺|要求|拒绝|帮助|支持|安慰|陪伴|解释|提醒|关闭|关上|打开|咬|清洗|清理|完成)/gu],
    ["unverified_causality", /(?:因为|所以|因此|导致|结果是|从而|让[^，。！？!?；;]{0,8}(?:变得|觉得|感到))/gu],
    ["unverified_motive_or_value_judgment", /(?:为了|故意|想要|应该|需要|必须|建议|最好|值得|正确|错误|成功|失败|重要|不该)/gu]
  ];
  for (const [issue, pattern] of tokenGroups) {
    const outputTokens = new Set(value.match(pattern) ?? []);
    const sourceTokens = new Set(sourceText.match(pattern) ?? []);
    if ([...outputTokens].some((token) => !sourceTokens.has(token))) issues.push(issue);
  }
  return [...new Set(issues)];
}

/**
 * 来源协议只把“是否确实绑定到冻结来源”和“是否新增高风险事实”作为硬门。
 * 文本重合度用于观察，语义等价改写可以继续保留在 AI 结果中。
 */
export function assessEventJournalStructuredDraftGrounding(
  snapshot: JournalEventEntrySourceSnapshot,
  structuredDraft: EventJournalStructuredDraft,
  draft: EventJournalDraft
): EventJournalSourceProtocolGate {
  const sources = eventJournalSourceCatalog(snapshot);
  const sourceByRef = new Map(sources.map((source) => [source.ref, source]));
  if (sources.length === 0) {
    return {
      accepted: false,
      issues: ["missing_event_journal_source"],
      titleIssues: ["missing_event_journal_source"],
      bodyIssues: ["missing_event_journal_source"],
      titleRepaired: false,
      fullFallbackRequired: true,
      sourceRefsUsed: false
    };
  }

  const titleIssues = structuredDraft.title.sourceRefs.length === 0
    ? ["title_without_source_ref"]
    : structuredDraft.title.sourceRefs.some((ref) => !sourceByRef.has(ref))
      ? ["title_invalid_source_ref"]
      : [];
  const bodyIssues = structuredDraft.blocks.flatMap((block, index) => {
    if (block.sourceRefs.length === 0) return [
      `block_without_source_ref:${index + 1}`,
      "paragraph_without_source_anchor"
    ];
    if (block.sourceRefs.some((ref) => !sourceByRef.has(ref))) {
      return [`block_invalid_source_ref:${index + 1}`, "paragraph_without_source_anchor"];
    }
    return [];
  });
  const titleSafetyIssues = sourceProtocolSafetyIssues(draft.title, sources);
  const hardBodySafetyIssues = sourceProtocolSafetyIssues(draft.content, sources);
  const bodyWithSafetyIssues = [...bodyIssues, ...hardBodySafetyIssues];
  const titleRepaired = titleIssues.length > 0 || titleSafetyIssues.length > 0;
  const fullFallbackRequired = bodyWithSafetyIssues.length > 0;
  const contentUnits = draft.content
    .split(/[\n，。！？；,.!?;]+/u)
    .map((unit) => unit.trim())
    .filter((unit) => unit && unit !== "我看见的");
  const sourceTexts = sources.map((source) => source.text);
  const qualityDiagnostics = contentUnits.some((unit) =>
    !sourceTexts.some((text) => normalizeGroundingText(text).includes(normalizeGroundingText(unit)))
  ) ? ["paragraph_without_source_anchor"] : [];
  const issues = [...new Set([
    ...titleIssues,
    ...bodyWithSafetyIssues,
    ...qualityDiagnostics
  ])];
  return {
    accepted: !fullFallbackRequired,
    issues,
    titleIssues: [...new Set([...titleIssues, ...titleSafetyIssues])],
    bodyIssues: [...new Set(bodyWithSafetyIssues)],
    titleRepaired,
    fullFallbackRequired,
    sourceRefsUsed: structuredDraft.title.sourceRefs.length > 0 || structuredDraft.blocks.some((block) => block.sourceRefs.length > 0)
  };
}

function fallbackTitle(sentences: string[]) {
  const sourceTitle = sentences[0]
    ?.replace(/[“”"'《》【】（）()[\]]/gu, "")
    .split(/[，。！？；：,.!?;:]/u)[0]
    .trim();
  const conciseTitle = sourceTitle
    ?.replace(/^(?:今天|我今天|今天我|我|这件事|这一次|这一段)/u, "")
    .trim();
  const title = conciseTitle || sourceTitle || "这件事";
  return [...title].slice(0, 16).join("");
}

/**
 * 安全基础版本逐句取自冻结来源，仅补充结构性标点和日志标题。
 * 它的职责是保住“可保存的一件事”，不创造新的认识。
 */
export function buildSafeEventJournalFallback(
  snapshot: JournalEventEntrySourceSnapshot
): EventJournalDraft | null {
  const source = compactSource(snapshot);
  const eventFacts = uniqueSentences(
    source.facts
      .filter((fact) => fact.scope === "current_event")
      .map((fact) => fact.statement)
  );
  const userMessages = uniqueSentences(source.userMessages.map((message) => message.text));
  const narrative = eventFacts.length > 0 ? eventFacts : userMessages;
  if (narrative.length === 0) return null;

  const insightStatements = uniqueSentences(source.insights.map((insight) => insight.statement));
  const eventBody = narrative.map((sentence) => `${sentence}。`).join("\n\n");
  const insightBody = insightStatements.length > 0
    ? `\n\n我看见的\n\n${insightStatements.map((sentence) => `${sentence}。`).join("\n\n")}`
    : "";
  return {
    title: fallbackTitle(narrative),
    content: `${eventBody}${insightBody}`
  };
}

function checkpointForPhase(phase: string) {
  if (phase === "checkpoint_one") return "first" as const;
  if (phase === "checkpoint_two") return "second" as const;
  if (phase === "deep_companionship") return "deep_pause" as const;
  return null;
}

async function generateWithAI(input: {
  generation: JournalEventEntryGenerationRecord;
  requestId?: string | null;
}, attempts: StructuredOutputAttempt[]) {
  const provider = await getEventCenteredAIProvider();
  const envelope = buildEventJournalPrompt(input.generation.sourceSnapshot);
  const startedAt = Date.now();
  const providerDraft = await completeStructuredOutput({
    provider,
    stage: "generate",
    schema: z.union([eventJournalStructuredDraftSchema, eventJournalDraftSchema]),
    messages: envelope.messages,
    temperature: 0.2,
    maxTokens: 900,
    maxAttempts: EVENT_JOURNAL_AI_MAX_ATTEMPTS,
    timeoutMs: EVENT_JOURNAL_AI_TIMEOUT_MS,
    responseFormat: "json_object",
    thinking: "disabled",
    onAttempt: async (attempt) => {
      attempts.push(attempt);
      await recordAIInvocation({
        sessionId: input.generation.branchSessionId,
        traceId: input.generation.traceId,
        requestId: input.requestId ?? null,
        stage: "generate",
        attempt: attempt.attempt ?? attempts.length,
        provider: attempt.provider,
        model: readEventCenteredGenerativeModel(),
        envelope,
        responseText: attempt.responseText ?? null,
        params: {
          temperature: 0.2,
          maxTokens: 900,
          timeoutMs: EVENT_JOURNAL_AI_TIMEOUT_MS,
          responseFormat: "json_object",
          thinking: "disabled"
        },
        tokenUsage: attempt.tokenUsage ? { ...attempt.tokenUsage } : null,
        success: attempt.success,
        latencyMs: attempt.latencyMs,
        errorCode: attempt.errorCode
      });
    }
  });
  if (!providerDraft) throw new Error("EVENT_JOURNAL_AI_EMPTY");
  const compiled = compileEventJournalProviderDraft(
    providerDraft,
    input.generation.sourceSnapshot
  );
  const protocolGate = assessEventJournalStructuredDraftGrounding(
    input.generation.sourceSnapshot,
    compiled.structured,
    compiled.draft
  );
  return {
    draft: compiled.draft,
    structuredDraft: compiled.structured,
    protocolGate,
    structuredOutput: "blocks" in providerDraft,
    latencyMs: Date.now() - startedAt
  };
}

async function finishGeneration(input: {
  userId: string;
  generation: JournalEventEntryGenerationRecord;
  draft: EventJournalDraft;
  outputOrigin: "llm" | "fallback";
  attempts: StructuredOutputAttempt[];
  groundingGate: EventJournalGroundingGate;
  rejectedAIDraftIssues: string[];
  titleRepaired: boolean;
  sourceProtocol: {
    version: "source-refs.v1";
    structuredOutput: boolean;
    refsUsed: boolean;
  };
}) {
  return completeJournalEventEntryGeneration({
    userId: input.userId,
    generationId: input.generation.id,
    sourceFingerprint: input.generation.sourceFingerprint,
    title: input.draft.title,
    content: input.draft.content,
    outputOrigin: input.outputOrigin,
    qualityChecks: {
      sourceGrounded: input.groundingGate.accepted,
      basicQualityPassed: true
    },
    pipelineDecisions: [
      ...(input.rejectedAIDraftIssues.length > 0
        ? [{
            kind: "event_journal_ai_draft_rejected",
            issues: input.rejectedAIDraftIssues
          }]
        : []),
      {
        kind: "event_journal_quality_gate",
        accepted: input.groundingGate.accepted,
        issues: input.groundingGate.issues,
        sourceGrounded: input.groundingGate.accepted,
        basicQualityPassed: true
      },
      {
        kind: "event_journal_source_evidence_protocol",
        ...input.sourceProtocol
      },
      {
        kind: "event_journal_title_repaired",
        titleRepaired: input.titleRepaired
      },
      {
        kind: input.outputOrigin === "llm"
          ? "event_journal_llm_draft_accepted"
          : "event_journal_safe_fallback_used",
        promptVersion: EVENT_JOURNAL_PROMPT_VERSION,
        technicalAttempts: input.attempts.length,
        productQuality: "observe"
      }
    ]
  });
}

export async function generateJournalEventEntry(
  input: GenerateJournalEventEntryInput
): Promise<GenerateJournalEventEntryResult> {
  assertEventCenteredWriteAllowed();
  const before = await getEventCenteredInterviewWorkspace(input.userId, input.rootSessionId);
  if (!before?.eventId) throw new Error("EVENT_NOT_FOUND");
  if (
    before.activeBranchSessionId !== input.baseBranchSessionId ||
    before.latestMessageSequence !== input.baseMessageSequence
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  if (
    before.eventStatus !== "generating" &&
    !before.dialogue.allowedActions.includes("generate_event_journal")
  ) {
    throw new Error("EVENT_JOURNAL_GENERATION_NOT_ALLOWED");
  }

  const reserved = await reserveJournalEventEntryGeneration({
    userId: input.userId,
    eventId: before.eventId,
    activeBranchSessionId: input.baseBranchSessionId,
    clientOperationId: input.clientOperationId,
    baseMessageSequence: input.baseMessageSequence,
    requestId: input.requestId ?? null
  });

  if (reserved.kind === "entry") {
    const workspace = await getEventCenteredInterviewWorkspace(input.userId, input.rootSessionId);
    if (!workspace) throw new Error("SESSION_NOT_FOUND");
    return {
      entry: reserved.entry,
      workspace,
      generation: { origin: "existing", attemptCount: 0, latencyMs: 0 }
    };
  }

  const generation = reserved.generation;
  await recordEventCenteredAnalyticsEvent({
    eventName: "event_journal_generation_started",
    userId: input.userId,
    rootSessionId: before.rootSessionId,
    journalEventId: before.eventId,
    journalEntryId: generation.intendedEntryId,
    requestId: input.requestId ?? null,
    entryDate: before.entryDate,
    stage: before.dialogue.phase,
    angle: before.dialogue.activeAngle,
    checkpoint: checkpointForPhase(before.dialogue.phase),
    dedupeKey: `event_journal_generation_started:${generation.id}`
  });

  const attempts: StructuredOutputAttempt[] = [];
  let latencyMs = 0;
  let outputOrigin: "llm" | "fallback" = "llm";
  let rejectedAIDraftIssues: string[] = [];
  let titleRepaired = false;
  let structuredOutput = false;
  let sourceRefsUsed = false;
  let aiProtocolGate: EventJournalSourceProtocolGate | null = null;
  try {
    let draft: EventJournalDraft | null = null;
    const generationStartedAt = Date.now();
    try {
      const aiResult = await generateWithAI({
        generation,
        requestId: input.requestId
      }, attempts);
      latencyMs = aiResult.latencyMs;
      draft = aiResult.draft;
      structuredOutput = aiResult.structuredOutput;
      aiProtocolGate = aiResult.protocolGate;
      titleRepaired = aiResult.protocolGate.titleRepaired;
      sourceRefsUsed = aiResult.protocolGate.sourceRefsUsed;
      if (aiResult.protocolGate.fullFallbackRequired) {
        rejectedAIDraftIssues = aiResult.protocolGate.bodyIssues;
        outputOrigin = "fallback";
        draft = buildSafeEventJournalFallback(generation.sourceSnapshot);
      } else if (aiResult.protocolGate.titleRepaired) {
        const safeTitle = buildSafeEventJournalFallback(generation.sourceSnapshot)?.title;
        if (safeTitle) draft = { ...aiResult.draft, title: safeTitle };
      }
    } catch {
      latencyMs = Date.now() - generationStartedAt;
      outputOrigin = "fallback";
      draft = buildSafeEventJournalFallback(generation.sourceSnapshot);
    }
    if (!draft) {
      outputOrigin = "fallback";
      draft = buildSafeEventJournalFallback(generation.sourceSnapshot);
    }
    if (draft && outputOrigin === "llm" && !aiProtocolGate) {
      const aiGroundingGate = assessEventJournalDraftGrounding(generation.sourceSnapshot, draft);
      if (!aiGroundingGate.accepted) {
        rejectedAIDraftIssues = aiGroundingGate.issues;
        outputOrigin = "fallback";
        draft = buildSafeEventJournalFallback(generation.sourceSnapshot);
      }
    }
    if (!draft) {
      await failJournalEventEntryGeneration({
        userId: input.userId,
        generationId: generation.id,
        errorCode: "EVENT_JOURNAL_SOURCE_INSUFFICIENT"
      });
      throw new Error("EVENT_JOURNAL_SOURCE_INSUFFICIENT");
    }
    const groundingGate = outputOrigin === "llm" && aiProtocolGate
      ? {
          accepted: aiProtocolGate.accepted,
          issues: aiProtocolGate.issues
        }
      : assessEventJournalDraftGrounding(generation.sourceSnapshot, draft);
    if (!groundingGate.accepted) {
      await failJournalEventEntryGeneration({
        userId: input.userId,
        generationId: generation.id,
        errorCode: "EVENT_JOURNAL_SOURCE_UNVERIFIED"
      });
      throw new Error("EVENT_JOURNAL_SOURCE_UNVERIFIED");
    }

    const entry = await finishGeneration({
      userId: input.userId,
      generation,
      draft,
      outputOrigin,
      attempts,
      groundingGate,
      rejectedAIDraftIssues,
      titleRepaired: outputOrigin === "llm" && titleRepaired,
      sourceProtocol: {
        version: "source-refs.v1",
        structuredOutput,
        refsUsed: sourceRefsUsed
      }
    });
    await recordEventCenteredAnalyticsEvent({
      eventName: "event_journal_generated",
      userId: input.userId,
      rootSessionId: before.rootSessionId,
      journalEventId: before.eventId,
      journalEntryId: entry.id,
      requestId: input.requestId ?? null,
      entryDate: before.entryDate,
      stage: before.dialogue.phase,
      angle: before.dialogue.activeAngle,
      effectiveStrategy: outputOrigin === "llm" ? "event_journal_llm" : "event_journal_safe_fallback",
      attemptCount: attempts.length,
      latencyMs,
      dedupeKey: `event_journal_generated:${entry.id}:${entry.generationVersion}`
    });
    const workspace = await getEventCenteredInterviewWorkspace(input.userId, input.rootSessionId);
    if (!workspace) throw new Error("SESSION_NOT_FOUND");
    return {
      entry,
      workspace,
      generation: { origin: outputOrigin, attemptCount: attempts.length, latencyMs }
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "EVENT_JOURNAL_GENERATION_FAILED";
    if (
      code !== "EVENT_JOURNAL_SOURCE_INSUFFICIENT" &&
      code !== "EVENT_JOURNAL_SOURCE_UNVERIFIED" &&
      code !== "EVENT_GENERATION_SOURCE_CHANGED" &&
      code !== "EVENT_GENERATION_STATE_CHANGED"
    ) {
      await failJournalEventEntryGeneration({
        userId: input.userId,
        generationId: generation.id,
        errorCode: "EVENT_JOURNAL_GENERATION_FAILED"
      }).catch(() => undefined);
    }
    throw error;
  }
}

export function readJournalEventEntry(userId: string, entryId: string) {
  return getJournalEventEntryForUser({ userId, entryId });
}

export function editJournalEventEntry(input: UpdateJournalEventEntryInput) {
  assertEventCenteredWriteAllowed();
  return updateJournalEventEntry(input);
}

export async function confirmJournalEventEntry(input: SaveJournalEventEntryInput) {
  assertEventCenteredWriteAllowed();
  const entry = await saveJournalEventEntry(input);
  const workspace = entry.sourceBranchSessionId
    ? await getEventCenteredInterviewWorkspace(input.userId, entry.sourceBranchSessionId)
    : null;
  await recordEventCenteredAnalyticsEvent({
    eventName: "event_journal_saved",
    userId: input.userId,
    rootSessionId: workspace?.rootSessionId ?? null,
    journalEventId: entry.eventId,
    journalEntryId: entry.id,
    entryDate: entry.entryDate.slice(0, 10),
    dedupeKey: `event_journal_saved:${entry.id}:${entry.savedRevision ?? entry.contentRevision}`
  });
  return entry;
}
