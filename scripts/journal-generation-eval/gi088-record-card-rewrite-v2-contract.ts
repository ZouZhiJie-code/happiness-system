import { z } from "zod";

import { hashPromptContent } from "@/features/ai-quality/prompt-manifest";

import {
  sha256Canonical,
  type Gi088CalibrationRecordCard
} from "./gi088-calibration-contract";
import type { LoadedGi088CalibrationCase } from "./gi088-calibration-runner";
import {
  buildGi088RecordCardWritingMaterial,
  type Gi088RecordCardWritingMaterial
} from "./gi088-record-card-rewrite-contract";

export const GI088_RECORD_CARD_REWRITE_V2_VERSION =
  "2026-08-11.gi088-record-card-rewrite-v2" as const;
export const GI088_RECORD_CARD_REWRITE_V2_ROUND_ID =
  "gi088-record-card-rewrite-v2" as const;
export const GI088_RECORD_CARD_REWRITE_V2_PROMPT_VERSION =
  "2026-08-11.gi088-record-card-natural-event-writing-v2" as const;

export const GI088_SHARED_NATURAL_JOURNAL_WRITING_CORE_V1 = [
  "使用第一人称、克制自然的中文书面表达。",
  "先识别材料中实际存在的叙述主线，再按照事件逻辑组织句序。",
  "完整保留事实、感受、否定和不确定性，并维持用户真实的情绪强度。",
  "清理问答过程、口头禅、重复表达和不连贯句式。",
  "把有效认识放进对应事件的发展或自然收束位置，同一含义只表达一次。",
  "保留少量有辨识度的用户表达，其余内容转写为顺畅、可独立阅读的文字。",
  "事实边界限定于用户证据和当前有效认识；人物、时间、数字、原因、动机、建议和结论都需要来源支持。"
].join("\n");

export const GI088_RECORD_CARD_REWRITE_V2_SYSTEM_PROMPT = [
  "你把一条真实访谈整理成一张可直接阅读的第一人称事件记录卡。记录卡需要写透当前单个事件，完整表达事件、感受、不确定性和当前有效认识。",
  GI088_SHARED_NATURAL_JOURNAL_WRITING_CORE_V1,
  "一次完成两个步骤：先整理内部写作材料单元 materialUnits，再使用这些单元写出 card。",
  "每个 materialUnit 围绕一个语义独立的核心意思。相关事实、感受、不确定性和有效认识可以进入同一单元；同义内容合并一次，并在同一单元关联全部来源。",
  "coreMeaning 使用简洁中性的内部摘要，只说明这一单元讲什么，避免写成可直接拼接的成稿句子。",
  "evidenceSpans 只引用 userEvidence。quote 必须逐字复制 sourceRef 对应原话中的一个连续片段；每条 usage=content 的用户来源至少进入一个 evidenceSpan。",
  "validInsightRefs 只引用 validInsights。每条当前有效认识至少进入一个材料单元；同义认识可以与用户证据共同放在同一单元。",
  "excludedInteractionSpans 标记混合在用户回答中的访谈互动表达，例如评价提问、要求继续追问、说明自己难以回答。quote 同样逐字复制原话片段。",
  "questionContext 只帮助理解对应回答的方向。问题中的例子、选项、推测和措辞不承担事实来源，也不进入材料单元或记录卡。",
  "corrections 与 invalidatedUnderstandingRefs 约束当前事实边界，失效认识退出 materialUnits 和 card。",
  "card 根据事件主线重新写作。title 使用自然短标题；paragraphs 根据语义自然分段。每个标题或段落列出 usedUnitIds，且每个材料单元至少被使用一次。",
  "返回严格 JSON：{\"materialUnits\":[{\"unitId\":\"M1\",\"coreMeaning\":string,\"evidenceSpans\":[{\"sourceRef\":string,\"quote\":string}],\"validInsightRefs\":string[],\"excludedInteractionSpans\":[{\"sourceRef\":string,\"quote\":string}]}],\"card\":{\"title\":{\"text\":string,\"usedUnitIds\":string[]},\"paragraphs\":[{\"text\":string,\"usedUnitIds\":string[]}]}}。"
].join("\n");

export const GI088_RECORD_CARD_REWRITE_V2_SYSTEM_PROMPT_HASH = hashPromptContent(
  GI088_RECORD_CARD_REWRITE_V2_SYSTEM_PROMPT
);

const spanSchema = z.object({
  sourceRef: z.string().trim().min(1).max(160),
  quote: z.string().trim().min(1).max(4_000)
}).strict();

const outputSchema = z.object({
  materialUnits: z.array(z.object({
    unitId: z.string().trim().regex(/^M[1-9]\d*$/u),
    coreMeaning: z.string().trim().min(1).max(1_200),
    evidenceSpans: z.array(spanSchema).min(1).max(128),
    validInsightRefs: z.array(z.string().trim().min(1).max(160)).max(128),
    excludedInteractionSpans: z.array(spanSchema).max(128)
  }).strict()).min(1).max(128),
  card: z.object({
    title: z.object({
      text: z.string().trim().min(1).max(240),
      usedUnitIds: z.array(z.string().trim().min(1).max(40)).min(1).max(128)
    }).strict(),
    paragraphs: z.array(z.object({
      text: z.string().trim().min(1).max(12_000),
      usedUnitIds: z.array(z.string().trim().min(1).max(40)).min(1).max(128)
    }).strict()).min(1).max(64)
  }).strict()
}).strict();

export interface Gi088RecordCardV2EvidenceSpan {
  sourceRef: string;
  quote: string;
}

export interface Gi088RecordCardV2MaterialUnit {
  unitId: string;
  coreMeaning: string;
  evidenceSpans: Gi088RecordCardV2EvidenceSpan[];
  validInsightRefs: string[];
  excludedInteractionSpans: Gi088RecordCardV2EvidenceSpan[];
}

export interface Gi088RecordCardV2Paragraph {
  text: string;
  usedUnitIds: string[];
  sourceRefs: string[];
}

export interface Gi088RecordCardRewriteV2Diagnostics {
  question_context_leakage: string[];
  qa_process_residue: string[];
  long_source_copy: string[];
  repeated_sentence_openings: string[];
  insight_dump_markers: string[];
  oral_repetition_markers: string[];
  possible_unit_repetition: string[];
  title_too_long: string[];
}

export interface Gi088ParsedRecordCardRewriteV2 {
  accepted: boolean;
  issues: string[];
  diagnostics: Gi088RecordCardRewriteV2Diagnostics;
  materialUnits: Gi088RecordCardV2MaterialUnit[];
  recordCard: Gi088CalibrationRecordCard | null;
  paragraphs: Gi088RecordCardV2Paragraph[];
}

function normalized(value: string) {
  return value.replace(/[\s，。！？、,.!?：:；;“”‘’'"（）()《》〈〉【】\[\]]/gu, "").toLowerCase();
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

function emptyDiagnostics(): Gi088RecordCardRewriteV2Diagnostics {
  return {
    question_context_leakage: [],
    qa_process_residue: [],
    long_source_copy: [],
    repeated_sentence_openings: [],
    insight_dump_markers: [],
    oral_repetition_markers: [],
    possible_unit_repetition: [],
    title_too_long: []
  };
}

function possibleUnitRepetition(units: Gi088RecordCardV2MaterialUnit[]) {
  const repeated: string[] = [];
  for (let index = 0; index < units.length; index += 1) {
    const left = normalized(units[index].coreMeaning);
    if (left.length < 8) continue;
    for (let other = index + 1; other < units.length; other += 1) {
      const right = normalized(units[other].coreMeaning);
      if (right.length < 8) continue;
      if (left.includes(right) || right.includes(left)) {
        repeated.push(`${units[index].unitId}:${units[other].unitId}`);
      }
    }
  }
  return repeated;
}

function buildDiagnostics(input: {
  title: string;
  outputText: string;
  material: Gi088RecordCardWritingMaterial;
  units: Gi088RecordCardV2MaterialUnit[];
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
      input.outputText.match(/(?:AI问|AI提问|当被问到|我回答(?:说)?|你问我|你让我说|你刚才|这个问题|继续和我聊|继续问我|没理解我的|问到这里)/gu) ?? []
    )],
    long_source_copy: longSourceCopy,
    repeated_sentence_openings: sentenceOpenings(input.outputText),
    insight_dump_markers: [...new Set(
      input.outputText.match(/(?:这说明|这显示出|由此可见|总的来说|我意识到)/gu) ?? []
    )],
    oral_repetition_markers: [
      ...((input.outputText.match(/我觉得/gu)?.length ?? 0) >= 3 ? ["我觉得"] : []),
      ...((input.outputText.match(/就是/gu)?.length ?? 0) >= 4 ? ["就是"] : []),
      ...((input.outputText.match(/然后/gu)?.length ?? 0) >= 4 ? ["然后"] : [])
    ],
    possible_unit_repetition: possibleUnitRepetition(input.units),
    title_too_long: [...input.title].length > 20 ? [String([...input.title].length)] : []
  } satisfies Gi088RecordCardRewriteV2Diagnostics;
}

export function buildGi088RecordCardRewriteV2Prompt(
  source: LoadedGi088CalibrationCase,
  material = buildGi088RecordCardWritingMaterial(source)
) {
  const messages = [
    { role: "system" as const, content: GI088_RECORD_CARD_REWRITE_V2_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: JSON.stringify({
        userEvidence: material.userEvidence,
        validInsights: material.validInsights,
        corrections: material.corrections,
        invalidatedUnderstandingRefs: material.invalidatedUnderstandingRefs,
        questionContext: material.questionContext,
        sourceProjectionSha256: material.basedOnSourceProjectionSha256
      })
    }
  ];
  return {
    messages,
    resolvedPromptHash: sha256Canonical({
      promptVersion: GI088_RECORD_CARD_REWRITE_V2_PROMPT_VERSION,
      messages
    })
  };
}

export function parseGi088RecordCardRewriteV2Output(input: {
  source: LoadedGi088CalibrationCase;
  material: Gi088RecordCardWritingMaterial;
  content: string;
  finishReason: string | null;
}): Gi088ParsedRecordCardRewriteV2 {
  const diagnostics = emptyDiagnostics();
  if (input.finishReason !== "stop") {
    return {
      accepted: false,
      issues: [`RECORD_REWRITE_V2_FINISH_REASON_INVALID:${input.finishReason ?? "missing"}`],
      diagnostics,
      materialUnits: [],
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
      issues: ["RECORD_REWRITE_V2_JSON_INVALID"],
      diagnostics,
      materialUnits: [],
      recordCard: null,
      paragraphs: []
    };
  }
  const parsed = outputSchema.safeParse(json);
  if (!parsed.success) {
    return {
      accepted: false,
      issues: ["RECORD_REWRITE_V2_SCHEMA_INVALID"],
      diagnostics,
      materialUnits: [],
      recordCard: null,
      paragraphs: []
    };
  }

  const units = parsed.data.materialUnits;
  const unitIds = units.map((item) => item.unitId);
  const uniqueUnitIds = new Set(unitIds);
  const userByRef = new Map(input.material.userEvidence.map((item) => [item.sourceRef, item]));
  const validInsightRefs = new Set(input.material.validInsights.map((item) => item.sourceRef));
  const invalidatedRefs = new Set(input.material.invalidatedUnderstandingRefs);
  const usedUnitIds = [...new Set([
    ...parsed.data.card.title.usedUnitIds,
    ...parsed.data.card.paragraphs.flatMap((item) => item.usedUnitIds)
  ])];
  const evidenceRefs = [...new Set(units.flatMap((item) => item.evidenceSpans.map((span) => span.sourceRef)))];
  const usedInsightRefs = [...new Set(units.flatMap((item) => item.validInsightRefs))];
  const outputText = [
    parsed.data.card.title.text,
    ...parsed.data.card.paragraphs.map((item) => item.text)
  ].join("\n");
  const sourceCorpus = [
    ...input.material.userEvidence.map((item) => item.text),
    ...input.material.validInsights.map((item) => item.text)
  ].join("\n");
  const normalizedSourceCorpus = normalized(sourceCorpus);

  const issues: string[] = [];
  if (uniqueUnitIds.size !== unitIds.length) issues.push("RECORD_REWRITE_V2_UNIT_ID_DUPLICATED");
  for (const used of usedUnitIds) {
    if (!uniqueUnitIds.has(used)) issues.push(`RECORD_REWRITE_V2_UNIT_ID_INVALID:${used}`);
  }
  for (const unitId of uniqueUnitIds) {
    if (!usedUnitIds.includes(unitId)) issues.push(`RECORD_REWRITE_V2_UNIT_UNUSED:${unitId}`);
  }
  for (const unit of units) {
    for (const span of [...unit.evidenceSpans, ...unit.excludedInteractionSpans]) {
      const sourceItem = userByRef.get(span.sourceRef);
      if (!sourceItem) {
        issues.push(`RECORD_REWRITE_V2_EVIDENCE_SOURCE_INVALID:${span.sourceRef}`);
      } else if (!sourceItem.text.includes(span.quote)) {
        issues.push(`RECORD_REWRITE_V2_EVIDENCE_QUOTE_INVALID:${span.sourceRef}`);
      }
    }
    const evidenceKeys = new Set(unit.evidenceSpans.map((span) => `${span.sourceRef}\u0000${span.quote}`));
    for (const span of unit.excludedInteractionSpans) {
      if (evidenceKeys.has(`${span.sourceRef}\u0000${span.quote}`)) {
        issues.push(`RECORD_REWRITE_V2_SPAN_ROLE_CONFLICT:${span.sourceRef}`);
      }
      if (normalized(span.quote).length >= 4 && normalized(outputText).includes(normalized(span.quote))) {
        issues.push(`RECORD_REWRITE_V2_INTERACTION_SPAN_LEAKED:${span.sourceRef}`);
      }
    }
    for (const ref of unit.validInsightRefs) {
      if (!validInsightRefs.has(ref) || invalidatedRefs.has(ref)) {
        issues.push(`RECORD_REWRITE_V2_INSIGHT_REF_INVALID:${ref}`);
      }
    }
  }
  for (const item of input.material.userEvidence.filter((item) => item.usage === "content")) {
    if (!evidenceRefs.includes(item.sourceRef)) {
      issues.push(`RECORD_REWRITE_V2_CONTENT_SOURCE_UNMAPPED:${item.sourceRef}`);
    }
  }
  for (const insight of input.material.validInsights) {
    if (!usedInsightRefs.includes(insight.sourceRef)) {
      issues.push(`RECORD_REWRITE_V2_VALID_INSIGHT_UNMAPPED:${insight.sourceRef}`);
    }
  }
  for (const value of textNumbers(outputText)) {
    if (!sourceCorpus.includes(value)) issues.push(`RECORD_REWRITE_V2_UNSUPPORTED_NUMBER:${value}`);
  }
  for (const value of quotedPhrases(outputText)) {
    if (!normalizedSourceCorpus.includes(normalized(value))) {
      issues.push(`RECORD_REWRITE_V2_UNSUPPORTED_QUOTE:${value}`);
    }
  }
  for (const value of input.source.invalidatedUnderstandingSummaries) {
    if (normalized(value).length >= 8 && normalized(outputText).includes(normalized(value))) {
      issues.push("RECORD_REWRITE_V2_INVALIDATED_UNDERSTANDING_REVIVED");
    }
  }

  const writingDiagnostics = buildDiagnostics({
    title: parsed.data.card.title.text,
    outputText,
    material: input.material,
    units
  });
  if (writingDiagnostics.question_context_leakage.length > 0) {
    issues.push("RECORD_REWRITE_V2_QUESTION_CONTEXT_FACT_LEAKAGE");
  }

  const unitById = new Map(units.map((unit) => [unit.unitId, unit]));
  const sourceRefsForUnits = (ids: string[]) => [...new Set(ids.flatMap((id) => {
    const unit = unitById.get(id);
    return unit ? [
      ...unit.evidenceSpans.map((span) => span.sourceRef),
      ...unit.validInsightRefs
    ] : [];
  }))];
  const paragraphs = parsed.data.card.paragraphs.map((paragraph) => ({
    text: paragraph.text,
    usedUnitIds: [...paragraph.usedUnitIds],
    sourceRefs: sourceRefsForUnits(paragraph.usedUnitIds)
  }));
  const allCardUnitIds = [...new Set([
    ...parsed.data.card.title.usedUnitIds,
    ...paragraphs.flatMap((paragraph) => paragraph.usedUnitIds)
  ])];
  const recordCard: Gi088CalibrationRecordCard = {
    record_card_id: `record-rewrite-v2-${sha256Canonical({
      caseId: input.source.selection.caseId,
      sourceProjectionSha256: input.source.sourceProjectionSha256,
      promptVersion: GI088_RECORD_CARD_REWRITE_V2_PROMPT_VERSION
    }).slice(0, 20)}`,
    event_id: input.source.snapshot.eventId,
    title: parsed.data.card.title.text,
    text: paragraphs.map((paragraph) => paragraph.text).join("\n\n"),
    insight: "",
    source_refs: sourceRefsForUnits(allCardUnitIds)
  };
  return {
    accepted: issues.length === 0,
    issues: [...new Set(issues)],
    diagnostics: writingDiagnostics,
    materialUnits: units.map((unit) => ({
      unitId: unit.unitId,
      coreMeaning: unit.coreMeaning,
      evidenceSpans: unit.evidenceSpans.map((span) => ({ ...span })),
      validInsightRefs: [...unit.validInsightRefs],
      excludedInteractionSpans: unit.excludedInteractionSpans.map((span) => ({ ...span }))
    })),
    recordCard,
    paragraphs
  };
}
