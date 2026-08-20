import { z } from "zod";

import { hashPromptContent } from "@/features/ai-quality/prompt-manifest";

import {
  sha256Canonical,
  type Gi088CalibrationRecordCard
} from "./gi088-calibration-contract";
import type { LoadedGi088CalibrationCase } from "./gi088-calibration-runner";

export const GI088_RECORD_CARD_REWRITE_VERSION =
  "2026-08-11.gi088-record-card-rewrite-v1" as const;
export const GI088_RECORD_CARD_REWRITE_ROUND_ID =
  "gi088-record-card-rewrite-remediation" as const;
export const GI088_RECORD_CARD_REWRITE_PROMPT_VERSION =
  "2026-08-11.gi088-record-card-natural-event-writing-v1" as const;

export const GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT = [
  "你把一条真实访谈整理成一张可直接阅读的第一人称事件记录卡。",
  "先识别材料中实际存在的事件主线，再组织标题和连续自然的正文。允许按事件逻辑调整事实、感受和认识的位置，但不得改变时间关系、因果关系和原意。",
  "完整表达所有 requiredSourceRefs 对应且有记录价值的独立事实、感受、否定、不确定性和有效认识。重复表达可以合并，访谈控制话语和问答过程不进入正文。",
  "validInsights 是 AI 基于用户证据提出、且用户未否定或未纠正的当前有效认识；把它们自然融入对应事件或收束位置，同一含义只表达一次。",
  "questionContext 只帮助理解对应用户回答的方向。问题中的例子、选项、推测和措辞不能成为事实来源，正文不能留下 AI 问答痕迹。",
  "按照用户本人的语言风格表达，保留真实情绪强度和有辨识度的表达。可以自然改写，无需机械复制原句；清理口头禅、重复句式、连续的‘我觉得’和不连贯表达。",
  "根据语义内容自然分段并保证可读性，不按固定段落数量写作。",
  "事实边界只来自 userEvidence 和 validInsights。禁止新增事实、人物、时间、数字、原因、动机、建议、共同主题和文学化扩写。",
  "返回严格 JSON：{\"title\":{\"text\":string,\"sourceRefs\":string[]},\"paragraphs\":[{\"text\":string,\"sourceRefs\":string[]}]}。",
  "title 简短自然。每个 title 和 paragraph 至少引用一项 allowedSourceRefs；questionContext 不能作为 sourceRef。"
].join("\n");

export const GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT_HASH = hashPromptContent(
  GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT
);

export interface Gi088RecordCardWritingMaterial {
  caseId: string;
  basedOnSourceProjectionSha256: string;
  userEvidence: Array<{
    sourceRef: string;
    text: string;
    usage: "content" | "interaction_context";
  }>;
  validInsights: Array<{
    sourceRef: string;
    text: string;
    evidenceRefs: string[];
  }>;
  corrections: LoadedGi088CalibrationCase["projection"]["corrections"];
  invalidatedUnderstandingRefs: string[];
  questionContext: Array<{
    answerSourceRef: string;
    questions: string[];
  }>;
  allowedSourceRefs: string[];
  requiredSourceRefs: string[];
}

export interface Gi088RecordCardRewriteDiagnostics {
  question_context_leakage: string[];
  qa_process_residue: string[];
  long_source_copy: string[];
  repeated_sentence_openings: string[];
  insight_dump_markers: string[];
  oral_repetition_markers: string[];
}

export interface Gi088ParsedRecordCardRewrite {
  accepted: boolean;
  issues: string[];
  diagnostics: Gi088RecordCardRewriteDiagnostics;
  recordCard: Gi088CalibrationRecordCard | null;
  paragraphs: Array<{ text: string; sourceRefs: string[] }>;
}

const outputSchema = z.object({
  title: z.object({
    text: z.string().trim().min(1).max(16),
    sourceRefs: z.array(z.string().trim().min(1).max(160)).min(1).max(64)
  }).strict(),
  paragraphs: z.array(z.object({
    text: z.string().trim().min(1).max(12_000),
    sourceRefs: z.array(z.string().trim().min(1).max(160)).min(1).max(128)
  }).strict()).min(1).max(64)
}).strict();

const INTERACTION_ONLY_PATTERNS = [
  /^(?:好|好的|嗯|可以)[，,。.!！\s]*(?:继续(?:问我|聊|吧|说)?[。.!！\s]*)?$/u,
  /^继续(?:问我|聊|吧|说)?[。.!！\s]*$/u,
  /^你继续问我吧?[。.!！\s]*$/u
] as const;

function normalized(value: string) {
  return value.replace(/[\s，。！？、,.!?：:；;“”‘’'"（）()《》〈〉【】\[\]]/gu, "").toLowerCase();
}

function interactionOnly(value: string) {
  const text = value.trim();
  if (INTERACTION_ONLY_PATTERNS.some((pattern) => pattern.test(text))) return true;
  const compact = normalized(text);
  return /^(?:(?:好|好的)|继续(?:问我|聊|吧|说)|你继续问我吧?)+$/u.test(compact);
}

function extractQuestions(value: string) {
  const matches = value.match(/[^。！？!?\n]{2,}[？?]/gu) ?? [];
  return matches.map((item) => item.trim()).filter(Boolean);
}

export function buildGi088RecordCardWritingMaterial(
  source: LoadedGi088CalibrationCase
): Gi088RecordCardWritingMaterial {
  const userEvidence = source.projection.transcript
    .filter((message) => message.role === "user" && message.citable)
    .map((message) => ({
      sourceRef: message.ref,
      text: message.content.trim(),
      usage: interactionOnly(message.content) ? "interaction_context" as const : "content" as const
    }));
  const interactionRefs = new Set(
    userEvidence.filter((item) => item.usage === "interaction_context").map((item) => item.sourceRef)
  );
  const validInsights = source.projection.validUnderstandings
    .filter((item) => !item.evidenceRefs.every((ref) => interactionRefs.has(ref)))
    .map((item) => ({
      sourceRef: item.ref,
      text: item.summary.trim(),
      evidenceRefs: [...item.evidenceRefs]
    }));
  const questionContext: Gi088RecordCardWritingMaterial["questionContext"] = [];
  let pendingQuestions: string[] = [];
  for (const message of source.projection.transcript) {
    if (message.role === "assistant") {
      const questions = extractQuestions(message.content);
      if (questions.length > 0) pendingQuestions = questions;
      continue;
    }
    if (message.role !== "user" || !message.citable) continue;
    if (pendingQuestions.length > 0) {
      questionContext.push({
        answerSourceRef: message.ref,
        questions: [...pendingQuestions]
      });
    }
    pendingQuestions = [];
  }
  const allowedSourceRefs = [
    ...userEvidence.map((item) => item.sourceRef),
    ...validInsights.map((item) => item.sourceRef)
  ];
  const requiredSourceRefs = [
    ...userEvidence.filter((item) => item.usage === "content").map((item) => item.sourceRef),
    ...validInsights.map((item) => item.sourceRef)
  ];
  return {
    caseId: source.selection.caseId,
    basedOnSourceProjectionSha256: source.sourceProjectionSha256,
    userEvidence,
    validInsights,
    corrections: source.projection.corrections.map((item) => ({ ...item })),
    invalidatedUnderstandingRefs: [...source.projection.invalidations],
    questionContext,
    allowedSourceRefs,
    requiredSourceRefs
  };
}

export function buildGi088RecordCardRewritePrompt(
  source: LoadedGi088CalibrationCase,
  material = buildGi088RecordCardWritingMaterial(source)
) {
  const messages = [
    { role: "system" as const, content: GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: JSON.stringify({
        userEvidence: material.userEvidence,
        validInsights: material.validInsights,
        corrections: material.corrections,
        invalidatedUnderstandingRefs: material.invalidatedUnderstandingRefs,
        questionContext: material.questionContext,
        allowedSourceRefs: material.allowedSourceRefs,
        requiredSourceRefs: material.requiredSourceRefs
      })
    }
  ];
  return {
    messages,
    resolvedPromptHash: sha256Canonical({
      promptVersion: GI088_RECORD_CARD_REWRITE_PROMPT_VERSION,
      messages
    })
  };
}

function textNumbers(value: string) {
  return [...new Set(value.match(/\d+(?:\.\d+)?%?/gu) ?? [])];
}

function quotedPhrases(value: string) {
  return [...value.matchAll(/[“‘"]([^”’"]{2,})[”’"]/gu)].map((match) => match[1].trim());
}

function sentenceOpenings(value: string) {
  const counts = new Map<string, number>();
  for (const sentence of value.split(/[。！？!?\n]+/u).map((item) => item.trim()).filter(Boolean)) {
    const opening = [...normalized(sentence)].slice(0, 4).join("");
    if (opening.length < 2) continue;
    counts.set(opening, (counts.get(opening) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count >= 3).map(([opening]) => opening);
}

function buildDiagnostics(input: {
  outputText: string;
  material: Gi088RecordCardWritingMaterial;
}) {
  const normalizedOutput = normalized(input.outputText);
  const userCorpus = normalized(input.material.userEvidence.map((item) => item.text).join("\n"));
  const questionLeakage = input.material.questionContext.flatMap((item) => item.questions)
    .filter((question) => {
      const phrase = normalized(question);
      return phrase.length >= 8 && normalizedOutput.includes(phrase) && !userCorpus.includes(phrase);
    });
  const longSourceCopy = input.material.userEvidence
    .filter((item) => item.usage === "content")
    .filter((item) => {
      const phrase = normalized(item.text);
      return phrase.length >= 32 && normalizedOutput.includes(phrase);
    })
    .map((item) => item.sourceRef);
  return {
    question_context_leakage: questionLeakage,
    qa_process_residue: [...new Set(
      input.outputText.match(/(?:AI问|AI提问|当被问到|我回答(?:说)?|你问我|这个问题)/gu) ?? []
    )],
    long_source_copy: longSourceCopy,
    repeated_sentence_openings: sentenceOpenings(input.outputText),
    insight_dump_markers: [...new Set(
      input.outputText.match(/(?:这说明|这显示出|由此可见|我意识到)/gu) ?? []
    )],
    oral_repetition_markers: [
      ...((input.outputText.match(/我觉得/gu)?.length ?? 0) >= 3 ? ["我觉得"] : []),
      ...((input.outputText.match(/就是/gu)?.length ?? 0) >= 4 ? ["就是"] : [])
    ]
  } satisfies Gi088RecordCardRewriteDiagnostics;
}

export function parseGi088RecordCardRewriteOutput(input: {
  source: LoadedGi088CalibrationCase;
  material: Gi088RecordCardWritingMaterial;
  content: string;
  finishReason: string | null;
}): Gi088ParsedRecordCardRewrite {
  const emptyDiagnostics: Gi088RecordCardRewriteDiagnostics = {
    question_context_leakage: [],
    qa_process_residue: [],
    long_source_copy: [],
    repeated_sentence_openings: [],
    insight_dump_markers: [],
    oral_repetition_markers: []
  };
  if (input.finishReason !== "stop") {
    return {
      accepted: false,
      issues: [`RECORD_REWRITE_FINISH_REASON_INVALID:${input.finishReason ?? "missing"}`],
      diagnostics: emptyDiagnostics,
      recordCard: null,
      paragraphs: []
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(input.content) as unknown;
  } catch {
    return {
      accepted: false,
      issues: ["RECORD_REWRITE_JSON_INVALID"],
      diagnostics: emptyDiagnostics,
      recordCard: null,
      paragraphs: []
    };
  }
  const parsed = outputSchema.safeParse(json);
  if (!parsed.success) {
    return {
      accepted: false,
      issues: ["RECORD_REWRITE_SCHEMA_INVALID"],
      diagnostics: emptyDiagnostics,
      recordCard: null,
      paragraphs: []
    };
  }
  const allowed = new Set(input.material.allowedSourceRefs);
  const usedRefs = [...new Set([
    ...parsed.data.title.sourceRefs,
    ...parsed.data.paragraphs.flatMap((paragraph) => paragraph.sourceRefs)
  ])];
  const outputText = [parsed.data.title.text, ...parsed.data.paragraphs.map((item) => item.text)].join("\n");
  const sourceCorpus = [
    ...input.material.userEvidence.map((item) => item.text),
    ...input.material.validInsights.map((item) => item.text)
  ].join("\n");
  const normalizedSourceCorpus = normalized(sourceCorpus);
  const issues = [
    ...usedRefs.filter((ref) => !allowed.has(ref)).map((ref) => `RECORD_REWRITE_SOURCE_REF_INVALID:${ref}`),
    ...input.material.requiredSourceRefs.filter((ref) => !usedRefs.includes(ref))
      .map((ref) => `RECORD_REWRITE_REQUIRED_SOURCE_OMITTED:${ref}`),
    ...textNumbers(outputText).filter((value) => !sourceCorpus.includes(value))
      .map((value) => `RECORD_REWRITE_UNSUPPORTED_NUMBER:${value}`),
    ...quotedPhrases(outputText).filter((value) => !normalizedSourceCorpus.includes(normalized(value)))
      .map((value) => `RECORD_REWRITE_UNSUPPORTED_QUOTE:${value}`),
    ...input.source.invalidatedUnderstandingSummaries
      .filter((value) => normalized(value).length >= 8 && normalized(outputText).includes(normalized(value)))
      .map(() => "RECORD_REWRITE_INVALIDATED_UNDERSTANDING_REVIVED")
  ];
  const diagnostics = buildDiagnostics({ outputText, material: input.material });
  if (diagnostics.question_context_leakage.length > 0) {
    issues.push("RECORD_REWRITE_QUESTION_CONTEXT_FACT_LEAKAGE");
  }
  const recordCard: Gi088CalibrationRecordCard = {
    record_card_id: `record-rewrite-${sha256Canonical({
      caseId: input.source.selection.caseId,
      sourceProjectionSha256: input.source.sourceProjectionSha256,
      promptVersion: GI088_RECORD_CARD_REWRITE_PROMPT_VERSION
    }).slice(0, 20)}`,
    event_id: input.source.snapshot.eventId,
    title: parsed.data.title.text,
    text: parsed.data.paragraphs.map((item) => item.text).join("\n\n"),
    insight: "",
    source_refs: usedRefs
  };
  return {
    accepted: issues.length === 0,
    issues: [...new Set(issues)],
    diagnostics,
    recordCard,
    paragraphs: parsed.data.paragraphs
  };
}
