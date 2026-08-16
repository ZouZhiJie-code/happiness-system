/* eslint-disable @typescript-eslint/no-explicit-any -- historical exports intentionally preserve several frozen JSON shapes */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, any>;

export type HistoricalReviewLabel = "direct_use" | "minor_issue" | "quality_failure" | "single_case_blocker";
export type EvidenceIntegrity = "all_turns_valid" | "contains_recovery_or_failure" | "no_substantive_ai_response";

export type HistoricalConversation = {
  conversationId: string;
  topicId: string;
  topicTitle: string;
  taskId: string;
  branchMode: string;
  branchId: string;
  sourceId: string;
  sourceIdentity: Json;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  turns: Array<{
    id: string;
    userMessageId: string | null;
    status: string;
    visibleText: string;
    validationIssues: string[];
    callEvidence: Array<{ id: string | null; status: string | null; requestHash: string | null; responseHash: string | null }>;
    questionReview: null | { classification: string; note: string; reviewedAt: string | null };
  }>;
  historicalReview: { label: HistoricalReviewLabel; reason: string; reviewedAt: string; authority: "product_owner_direct_historical_review" };
  evidenceIntegrity: EvidenceIntegrity;
  messageCount: number;
  turnCount: number;
  statusCounts: Record<string, number>;
  conversationFingerprint: string;
};

const VERSION = "2026-08-16.gi088-historical-real-gold-v1.1";
const FROZEN_GENERATED_AT = "2026-08-16T11:15:07.810Z";
const ROOT = "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";

const SOURCE_CONFIGS = [
  {
    sourceId: "gi088-v1",
    label: "GI-088 v1｜普通／思考对照",
    file: "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-readonly-db-snapshot.json",
    expectedReviewedBranches: 16
  },
  {
    sourceId: "gi088-v6",
    label: "GI-088 v6｜单一回答焦点",
    file: "artifacts/local-runtime/gi088/2026-08-09-gi088-human-eval-v6-single-focus/gi088-v6-2-of-4-private-export.json",
    expectedReviewedBranches: 2
  },
  {
    sourceId: "gi088-v7r4",
    label: "GI-088 v7r4｜连续性基线",
    file: "artifacts/local-runtime/gi088-v7r4-sealed/v7r4-sealed-export.json",
    expectedReviewedBranches: 2
  },
  {
    sourceId: "gi088-v8",
    label: "GI-088 v8｜问题决策",
    file: "artifacts/local-runtime/gi088-v8-sealed/v8-sealed-export.json",
    expectedReviewedBranches: 1
  },
  {
    sourceId: "gi088-v8r1",
    label: "GI-088 v8r1｜误停回归",
    file: "artifacts/local-runtime/gi088-v8r1-post-v8r2-baseline-20260810.json",
    expectedReviewedBranches: 1
  }
] as const;

const EXCLUDED_DUPLICATE_SOURCE = "artifacts/local-runtime/gi088-v8r1-pre-v8r2-baseline-20260810.json";

const TOPICS = [
  { topicId: "HT-01", sourceId: "gi088-v1", taskId: "A1", title: "模拟面试与逐字稿表达" },
  { topicId: "HT-02", sourceId: "gi088-v1", taskId: "A2", title: "亲密关系是否继续" },
  { topicId: "HT-03", sourceId: "gi088-v1", taskId: "A3", title: "小狗带来的幸福感" },
  { topicId: "HT-04", sourceId: "gi088-v1", taskId: "A4", title: "害怕未来无法继续养狗" },
  { topicId: "HT-05", sourceId: "gi088-v1", taskId: "A5", title: "养狗风险与照顾责任" },
  { topicId: "HT-06", sourceId: "gi088-v1", taskId: "A6", title: "梳理自己的相亲标准" },
  { topicId: "HT-07", sourceId: "gi088-v1", taskId: "A7", title: "遛狗快乐与伴侣要求" },
  { topicId: "HT-08", sourceId: "gi088-v1", taskId: "A8", title: "流浪小狗黑豆" },
  { topicId: "HT-09", sourceId: "gi088-v6", taskId: "A1", title: "梦见参加大厂线下考试" },
  { topicId: "HT-10", sourceId: "gi088-v6", taskId: "A2", title: "怀念内蒙古旅行的放松" },
  { topicId: "HT-11", sourceId: "gi088-v7r4", taskId: "A1", title: "智力比较带来的不爽" },
  { topicId: "HT-12", sourceId: "gi088-v7r4", taskId: "A2", title: "对朋友从好感转为厌恶" },
  { topicId: "HT-13", sourceId: "gi088-v8", taskId: "A1", title: "朋友为什么不主动联系" },
  { topicId: "HT-14", sourceId: "gi088-v8r1", taskId: "A1", title: "奶奶给钱与询问工作的压力" }
] as const;

const QUALITY_RULER_BLUEPRINT = [
  {
    principleId: "QR-01",
    title: "抓住用户真正关心的重点",
    productQuestion: "回应和追问是否围绕用户此刻真正想梳理的核心，而非停留在表面信息？",
    evidence: [
      { branchId: "5346c5c0-2b5d-40b2-9a27-af94f2b0afc6", quote: "提问切入点非常好，符合我的产品设计的要求和提问策略。" },
      { branchId: "0eb443fa-2c3d-4526-9b1a-9d669ddc0bdd", quote: "可以帮助用户从一个事件，从一个比较抽象宽泛的事情具体化以及收敛。" }
    ]
  },
  {
    principleId: "QR-02",
    title: "追问带来新的材料",
    productQuestion: "新一轮是否帮助用户看到新的事实、感受、取舍或认识？",
    evidence: [
      { branchId: "bf1ea1bd-bfae-4aa6-abfd-aedc81c1b642", quote: "帮助用户把情感很细腻的部分挖掘出来了，而且挖掘的点很到位" }
    ]
  },
  {
    principleId: "QR-03",
    title: "避免重复索取已经说清楚的内容",
    productQuestion: "用户已经表达清楚后，AI 是否继续重复提问或换句话索取同一答案？",
    evidence: [
      { branchId: "2ca8be12-57a1-496f-8be8-eb1972321091", quote: "重复追问，且问的问题并不是重点。" }
    ]
  },
  {
    principleId: "QR-04",
    title: "保持一个主回答方向，允许两个彼此相关的问题",
    productQuestion: "一轮可以提出一到两个彼此相关的问题；它们是否共同服务于同一条反思路径，并且用户可以把它们作为一个连贯回答来接住？",
    currentProductStandard: "允许一次提出两个彼此相关的问题；当两个问题要求用户分别处理相互独立的回答任务时，才进入多任务质量问题。",
    historicalEvidenceBoundary: "下列历史原评价记录的是当时程序因检测到两个问题而拦截、最终没有可见提问的事实。它们不能直接证明“两个问题就是内容质量失败”。",
    evidence: [
      { branchId: "2731a87f-5b89-4caf-9afa-d3116aa0a257", quote: "一次提了两个问题。" },
      { branchId: "b71f97a2-3036-46b5-9fce-ab97c1a0c891", quote: "一次提了两个问题，导致规则校验失败" }
    ]
  },
  {
    principleId: "QR-05",
    title: "表达自然、有人味且负担合适",
    productQuestion: "回应是否自然、生动、容易接住，提问负担是否与用户状态相称？",
    evidence: [
      { comparisonTopicId: "HT-02", quote: "它的提问更有人味。没有开 thinking 模式，它的问题会很像机器或者 AI 说的话" },
      { comparisonTopicId: "HT-03", quote: "第一段的回应会比没有开 Think 模式的回应更自然生动。" }
    ]
  },
  {
    principleId: "QR-06",
    title: "接住纠正并按用户要求继续",
    productQuestion: "用户纠正理解或明确要求深挖后，AI 是否更新方向并继续推进？",
    evidence: [
      { branchId: "b5fe1164-525b-49bb-941d-c896e3d5d769", quote: "我纠正了 AI 的理解之后。表达了我的诉求，希望能够继续深挖。" },
      { branchId: "c0ffdfc8-f8e9-4d62-97f8-4ba5bbfb1a6e", quote: "当用户第一次让 AI 继续聊的时候，它没有继续往下聊，而是又总结了一遍。" }
    ]
  },
  {
    principleId: "QR-07",
    title: "正确理解继续、停止和结束",
    productQuestion: "用户继续表达时是否自然继续，明确结束时是否收住，并避免误判暂停？",
    evidence: [
      { branchId: "5b7af323-b21d-4220-b4bf-fcf8c7ac6157", quote: "用户继续去回复 AI 的话，就代表默认触发 AI 继续提问。" },
      { branchId: "59ee7f1d-0c1c-4eea-908f-7cf3aa9574e1", quote: "没说暂停啊，怎么就直接不追问了？" }
    ]
  },
  {
    principleId: "QR-08",
    title: "保持独立事件的边界",
    productQuestion: "用户同时提到不同事件时，AI 是否选择一个焦点或先确认关系，避免直接混合解释？",
    evidence: [
      { branchId: "917f336b-ab89-4e2a-979c-2b93aeb0fb8a", quote: "我提到的事情是两件互不相干的，但是他的提问是把这两件互不相干的事情混合在一起了。" }
    ]
  },
  {
    principleId: "QR-09",
    title: "技术稳定性属于完整体验",
    productQuestion: "内容表现良好时，拦截、空输出或中断是否仍然破坏用户获得价值的过程？",
    evidence: [
      { branchId: "b4edcf05-8b0c-4709-a22d-5857bb43a132", quote: "提问是非常好的，但为什么总是出现技术失败呢？这个体验感太差了。" },
      { branchId: "b5fe1164-525b-49bb-941d-c896e3d5d769", quote: "怎么又遇到技术阻断了？到底什么情况？很影响我的体验。" }
    ]
  }
] as const;

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Json).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonical(value));
}

async function json(file: string): Promise<Json> {
  return JSON.parse(await readFile(file, "utf8")) as Json;
}

async function fileSha(file: string) {
  return sha(await readFile(file));
}

function tasksOf(raw: Json): Json[] {
  return raw.batch?.tasks ?? raw.batch?.state?.tasks ?? raw.record?.state?.tasks ?? [];
}

function sourceIdentity(raw: Json, config: (typeof SOURCE_CONFIGS)[number], sourceSha256: string) {
  const evaluation = raw.evaluation ?? {};
  const batch = raw.batch ?? {};
  const record = raw.record ?? {};
  return {
    sourceId: config.sourceId,
    sourceLabel: config.label,
    sourceFile: config.file,
    sourceSha256,
    runId: batch.batchId ?? batch.id ?? record.id,
    runStatus: batch.status ?? batch.state?.status ?? record.status ?? record.state?.status,
    evaluationVersion: evaluation.version ?? batch.evaluationVersion ?? record.evaluationVersion,
    evaluationId: evaluation.id ?? batch.evaluationVersion ?? record.evaluationVersion,
    candidateFingerprint: evaluation.candidateFingerprint ?? batch.candidateFingerprint ?? record.candidateFingerprint,
    executionFingerprint: evaluation.executionFingerprint ?? batch.executionFingerprint ?? record.executionFingerprint,
    evaluationMode: evaluation.mode ?? batch.evaluationMode ?? batch.state?.evaluationMode ?? "historical_snapshot",
    model: Object.values(evaluation.configs ?? {}).map((item: any) => item.model).filter(Boolean).join(" / ") || "historical_snapshot"
  };
}

function statusCounts(turns: Json[]) {
  return turns.reduce<Record<string, number>>((counts, turn) => {
    const status = String(turn.status ?? "unknown");
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

function topicFor(sourceId: string, taskId: string) {
  const topic = TOPICS.find((item) => item.sourceId === sourceId && item.taskId === taskId);
  if (!topic) throw new Error(`GI088_HISTORICAL_TOPIC_NOT_FOUND:${sourceId}:${taskId}`);
  return topic;
}

function integrityOf(messages: Json[], turns: Json[]): EvidenceIntegrity {
  const firstUserIndex = messages.findIndex((message) => message.role === "user");
  const assistantAfterUser = firstUserIndex >= 0 && messages.slice(firstUserIndex + 1).some((message) => message.role === "assistant" && String(message.content ?? "").trim());
  if (!assistantAfterUser) return "no_substantive_ai_response";
  if (turns.every((turn) => turn.status === "valid")) return "all_turns_valid";
  return "contains_recovery_or_failure";
}

function normalizeTurn(turn: Json) {
  return {
    id: String(turn.id),
    userMessageId: turn.userMessageId ? String(turn.userMessageId) : null,
    status: String(turn.status ?? "unknown"),
    visibleText: String(turn.visibleText ?? ""),
    validationIssues: (turn.validationIssues ?? []).map(String),
    callEvidence: (turn.calls ?? []).map((call: Json) => ({
      id: call.id ? String(call.id) : null,
      status: call.status ? String(call.status) : null,
      requestHash: call.requestHash ? String(call.requestHash) : null,
      responseHash: call.responseHash ? String(call.responseHash) : null
    })),
    questionReview: turn.questionObservation?.review ? {
      classification: String(turn.questionObservation.review.classification),
      note: String(turn.questionObservation.review.note ?? ""),
      reviewedAt: turn.questionObservation.review.reviewedAt ? String(turn.questionObservation.review.reviewedAt) : null
    } : null
  };
}

function buildConversation(input: {
  raw: Json;
  config: (typeof SOURCE_CONFIGS)[number];
  source: Json;
  task: Json;
  branchKey: string;
  branch: Json;
}): HistoricalConversation {
  const { config, source, task, branchKey, branch } = input;
  const topic = topicFor(config.sourceId, String(task.taskId));
  const messages = (branch.messages ?? []).filter((message: Json) => message.role === "user" || message.role === "assistant").map((message: Json) => ({
    id: String(message.id), role: message.role as "user" | "assistant", content: String(message.content)
  }));
  const rawTurns = (branch.turns ?? []) as Json[];
  const turns = rawTurns.map(normalizeTurn);
  const review = branch.review;
  if (!review?.quality || !review?.reason || !review?.reviewedAt) throw new Error(`GI088_HISTORICAL_REVIEW_INCOMPLETE:${branch.id}`);
  const historicalReview = {
    label: String(review.quality) as HistoricalReviewLabel,
    reason: String(review.reason),
    reviewedAt: String(review.reviewedAt),
    authority: "product_owner_direct_historical_review" as const
  };
  const core = {
    topicId: topic.topicId,
    taskId: String(task.taskId),
    branchMode: branchKey,
    branchId: String(branch.id),
    sourceIdentity: source,
    messages,
    turns,
    historicalReview
  };
  return {
    conversationId: `HC-${topic.topicId.slice(3)}-${branchKey}`,
    topicId: topic.topicId,
    topicTitle: topic.title,
    taskId: String(task.taskId),
    branchMode: branchKey,
    branchId: String(branch.id),
    sourceId: config.sourceId,
    sourceIdentity: source,
    messages,
    turns,
    historicalReview,
    evidenceIntegrity: integrityOf(messages, rawTurns),
    messageCount: messages.length,
    turnCount: turns.length,
    statusCounts: statusCounts(rawTurns),
    conversationFingerprint: sha(canonicalJson(core))
  };
}

function assertHistoricalReviewQuote(conversation: HistoricalConversation, quote: string) {
  if (!conversation.historicalReview.reason.includes(quote)) throw new Error(`GI088_RULER_QUOTE_MISMATCH:${conversation.branchId}:${quote}`);
}

export async function buildHistoricalRealGold(cwd = process.cwd()) {
  const root = path.join(cwd, ROOT);
  const privateRoot = path.join(root, ".private/historical-real-gold-v1");
  const paths = {
    template: path.join(cwd, "scripts/gi088-historical-real-gold-template.html"),
    conversationLibrary: path.join(privateRoot, "conversation-library.json"),
    judgmentLedger: path.join(privateRoot, "historical-judgment-ledger.json"),
    runtimeLedger: path.join(privateRoot, "runtime-ledger.json"),
    qualityRuler: path.join(privateRoot, "quality-ruler-draft.json"),
    datasetIdentity: path.join(privateRoot, "dataset-identity.json"),
    html: path.join(privateRoot, "index.html"),
    receipt: path.join(root, "historical-real-gold-v1-receipt.json")
  };

  const template = await readFile(paths.template, "utf8");
  const sourceInputs = await Promise.all(SOURCE_CONFIGS.map(async (config) => {
    const file = path.join(cwd, config.file);
    const [raw, sourceSha256] = await Promise.all([json(file), fileSha(file)]);
    return { config, raw, source: sourceIdentity(raw, config, sourceSha256) };
  }));

  const conversations: HistoricalConversation[] = [];
  const comparisons: Json[] = [];
  for (const input of sourceInputs) {
    let reviewedCount = 0;
    for (const task of tasksOf(input.raw)) {
      for (const [branchKey, branch] of Object.entries(task.branches ?? {}) as Array<[string, Json]>) {
        if (!branch.review?.quality || !branch.review?.reason || !branch.review?.reviewedAt) continue;
        conversations.push(buildConversation({ ...input, task, branchKey, branch }));
        reviewedCount += 1;
      }
      if (task.comparison?.reason && task.comparison?.comparedAt) {
        const topic = topicFor(input.config.sourceId, String(task.taskId));
        comparisons.push({
          comparisonId: `CMP-${topic.topicId.slice(3)}`,
          topicId: topic.topicId,
          sourceId: input.config.sourceId,
          taskId: String(task.taskId),
          preference: String(task.comparison.preference),
          reason: String(task.comparison.reason),
          comparedAt: String(task.comparison.comparedAt),
          authority: "product_owner_direct_historical_review"
        });
      }
    }
    if (reviewedCount !== input.config.expectedReviewedBranches) throw new Error(`GI088_SOURCE_REVIEWED_COUNT_MISMATCH:${input.config.sourceId}:${reviewedCount}`);
  }

  const branchIds = new Set(conversations.map((item) => item.branchId));
  if (branchIds.size !== conversations.length) throw new Error("GI088_DUPLICATE_BRANCH_INCLUDED");
  const localActionReviews = conversations.flatMap((conversation) => conversation.turns.flatMap((turn) => turn.questionReview ? [{
    localReviewId: `LAR-${conversation.branchId}-${turn.id}`,
    conversationId: conversation.conversationId,
    topicId: conversation.topicId,
    branchId: conversation.branchId,
    turnId: turn.id,
    ...turn.questionReview,
    authority: "product_owner_direct_historical_review"
  }] : []));

  const overallReviews = conversations.map((conversation) => ({
    conversationId: conversation.conversationId,
    topicId: conversation.topicId,
    branchId: conversation.branchId,
    sourceId: conversation.sourceId,
    ...conversation.historicalReview
  }));
  const labels = overallReviews.reduce<Record<string, number>>((counts, review) => {
    counts[review.label] = (counts[review.label] ?? 0) + 1;
    return counts;
  }, {});
  const integrities = conversations.reduce<Record<string, number>>((counts, conversation) => {
    counts[conversation.evidenceIntegrity] = (counts[conversation.evidenceIntegrity] ?? 0) + 1;
    return counts;
  }, {});
  const totalMessages = conversations.reduce((sum, item) => sum + item.messageCount, 0);
  const totalTurns = conversations.reduce((sum, item) => sum + item.turnCount, 0);
  const totalStatusCounts = conversations.reduce<Record<string, number>>((counts, item) => {
    Object.entries(item.statusCounts).forEach(([status, count]) => { counts[status] = (counts[status] ?? 0) + count; });
    return counts;
  }, {});

  const conversationByBranch = new Map(conversations.map((item) => [item.branchId, item]));
  const comparisonByTopic = new Map(comparisons.map((item) => [item.topicId, item]));
  const qualityRuler = QUALITY_RULER_BLUEPRINT.map((principle) => ({
    ...principle,
    status: principle.principleId === "QR-04" ? "product_owner_corrected_current_standard" : "product_owner_confirmed_no_material_issue",
    evidence: principle.evidence.map((evidence) => {
      if ("branchId" in evidence) {
        const conversation = conversationByBranch.get(evidence.branchId);
        if (!conversation) throw new Error(`GI088_RULER_BRANCH_NOT_FOUND:${evidence.branchId}`);
        assertHistoricalReviewQuote(conversation, evidence.quote);
        return { ...evidence, conversationId: conversation.conversationId, topicId: conversation.topicId, evidenceType: "historical_overall_review" };
      }
      const comparison = comparisonByTopic.get(evidence.comparisonTopicId);
      if (!comparison || !String(comparison.reason).includes(evidence.quote)) throw new Error(`GI088_RULER_COMPARISON_QUOTE_MISMATCH:${evidence.comparisonTopicId}`);
      return { ...evidence, comparisonId: comparison.comparisonId, evidenceType: "historical_mode_comparison" };
    })
  }));

  const pairedTopics = TOPICS.filter((topic) => conversations.filter((conversation) => conversation.topicId === topic.topicId).length > 1).map((topic) => topic.topicId);
  const sourceFingerprints = Object.fromEntries(sourceInputs.map((input) => [input.config.sourceId, input.source.sourceSha256]));
  const datasetCore = {
    schemaVersion: "1.0",
    datasetVersion: VERSION,
    purpose: "恢复 Daily Light【陪我聊】历史真实表现、产品负责人原评价及其产品质量与回归证据职责。",
    supportedDecision: "过去出现过哪些真实表现、产品负责人当时怎样评价、哪些经验可以沉淀为质量标准与长期回归证据。",
    unsupportedDecisions: ["当前候选质量", "Judge 资格", "独立准入", "真人 Preview 结果", "发布资格"],
    reviewAuthority: "product_owner_direct_historical_review_only",
    sourcePolicy: "five_product_owner_confirmed_historical_runs_only",
    sourceFingerprints,
    excludedSources: {
      duplicateSnapshot: EXCLUDED_DUPLICATE_SOURCE,
      judgeCards: 0,
      gi086FixedContexts: 0,
      board7PresetCases: 0,
      hiddenV2: 0,
      counterfactuals: 0,
      syntheticCases: 0,
      codexReviews: 0
    },
    counts: {
      sources: SOURCE_CONFIGS.length,
      topics: TOPICS.length,
      pairedTopics: pairedTopics.length,
      conversations: conversations.length,
      messages: totalMessages,
      turns: totalTurns,
      localActionReviews: localActionReviews.length,
      comparisons: comparisons.length,
      labels,
      evidenceIntegrity: integrities,
      turnStatuses: totalStatusCounts
    }
  };
  const datasetFingerprint = sha(canonicalJson({ ...datasetCore, conversations, overallReviews, localActionReviews, comparisons, qualityRuler }));
  const generatedAt = FROZEN_GENERATED_AT;
  const conversationLibrary = { ...datasetCore, datasetFingerprint, generatedAt, topics: TOPICS, pairedTopics, conversations };
  const judgmentLedger = { schemaVersion: "1.0", datasetVersion: VERSION, datasetFingerprint, generatedAt, overallReviews, localActionReviews, comparisons };
  const runtimeLedger = {
    schemaVersion: "1.0", datasetVersion: VERSION, datasetFingerprint, generatedAt,
    counts: { evidenceIntegrity: integrities, turnStatuses: totalStatusCounts },
    entries: conversations.map((conversation) => ({
      conversationId: conversation.conversationId,
      topicId: conversation.topicId,
      branchId: conversation.branchId,
      sourceId: conversation.sourceId,
      evidenceIntegrity: conversation.evidenceIntegrity,
      messageCount: conversation.messageCount,
      turnCount: conversation.turnCount,
      statusCounts: conversation.statusCounts,
      runStatus: conversation.sourceIdentity.runStatus,
      conversationFingerprint: conversation.conversationFingerprint
    }))
  };
  const qualityRulerDraft = {
    schemaVersion: "1.0", datasetVersion: VERSION, datasetFingerprint, generatedAt,
    status: "product_owner_confirmed_with_qr04_corrected",
    sourceBoundary: "历史案例标签与原理由保持不变；当前质量标准同时记录产品负责人后续澄清，不新增参考回答。",
    principles: qualityRuler
  };
  const datasetIdentity = { ...datasetCore, datasetFingerprint, generatedAt, privateAssets: ["conversation-library.json", "historical-judgment-ledger.json", "runtime-ledger.json", "quality-ruler-draft.json", "index.html"] };
  const pageData = { identity: datasetIdentity, topics: TOPICS, pairedTopics, conversations, judgmentLedger, runtimeLedger, qualityRulerDraft };
  if (!template.includes("__GI088_HISTORICAL_REAL_GOLD__")) throw new Error("GI088_HISTORICAL_REAL_GOLD_TEMPLATE_PLACEHOLDER_MISSING");
  const html = template.replace("__GI088_HISTORICAL_REAL_GOLD__", JSON.stringify(pageData).replaceAll("<", "\\u003c"));

  const expectedLabels = { direct_use: 7, minor_issue: 4, quality_failure: 8, single_case_blocker: 3 };
  const expectedIntegrities = { all_turns_valid: 6, contains_recovery_or_failure: 14, no_substantive_ai_response: 2 };
  if (TOPICS.length !== 14 || conversations.length !== 22 || totalMessages !== 183 || totalTurns !== 88 || localActionReviews.length !== 24 || comparisons.length !== 8) {
    throw new Error(`GI088_HISTORICAL_COUNTS_MISMATCH:${TOPICS.length}/${conversations.length}/${totalMessages}/${totalTurns}/${localActionReviews.length}/${comparisons.length}`);
  }
  if (canonicalJson(labels) !== canonicalJson(expectedLabels)) throw new Error(`GI088_HISTORICAL_LABELS_MISMATCH:${canonicalJson(labels)}`);
  if (canonicalJson(integrities) !== canonicalJson(expectedIntegrities)) throw new Error(`GI088_HISTORICAL_INTEGRITY_MISMATCH:${canonicalJson(integrities)}`);
  if (pairedTopics.length !== 8) throw new Error(`GI088_HISTORICAL_PAIRED_TOPICS_MISMATCH:${pairedTopics.length}`);

  await mkdir(privateRoot, { recursive: true });
  await Promise.all([
    writeFile(paths.conversationLibrary, JSON.stringify(conversationLibrary, null, 2) + "\n"),
    writeFile(paths.judgmentLedger, JSON.stringify(judgmentLedger, null, 2) + "\n"),
    writeFile(paths.runtimeLedger, JSON.stringify(runtimeLedger, null, 2) + "\n"),
    writeFile(paths.qualityRuler, JSON.stringify(qualityRulerDraft, null, 2) + "\n"),
    writeFile(paths.datasetIdentity, JSON.stringify(datasetIdentity, null, 2) + "\n"),
    writeFile(paths.html, html)
  ]);

  const receipt = {
    schemaVersion: "1.0",
    receiptVersion: VERSION,
    generatedAt,
    status: "historical_real_gold_v1_1_ruler_confirmed_waiting_data_completeness_confirmation",
    counts: datasetCore.counts,
    sourceCount: SOURCE_CONFIGS.length,
    sourceFingerprints,
    duplicateSnapshotsIncluded: 0,
    formalGoldContamination: { judgeCards: 0, gi086FixedContexts: 0, board7PresetCases: 0, hiddenV2: 0, counterfactuals: 0, syntheticCases: 0, codexReviews: 0 },
    qualityChecks: {
      branchesWithSourceIdentityAndReview: 22,
      topicsWithLineage: 14,
      immutableHistoricalLabels: 22,
      qualityRulerPrinciplesWithHistoricalEvidence: qualityRuler.length,
      qualityRulerPrinciplesProductOwnerConfirmed: qualityRuler.length,
      correctedHistoricalInterpretations: 1,
      rescoringControls: 0,
      externalRequests: 0,
      businessModelCalls: 0,
      judgeCalls: 0,
      databaseChanges: 0,
      previewChanges: 0,
      productionChanges: 0
    },
    datasetFingerprint,
    privateHtmlFingerprint: sha(html),
    publicContentBoundary: { userUtterances: 0, aiResponses: 0, historicalReviewReasons: 0, localReviewNotes: 0 },
    conclusionBoundary: { supported: datasetCore.supportedDecision, unsupported: datasetCore.unsupportedDecisions }
  };
  await writeFile(paths.receipt, JSON.stringify(receipt, null, 2) + "\n");
  return { paths, conversationLibrary, judgmentLedger, runtimeLedger, qualityRulerDraft, datasetIdentity, receipt, html };
}

if (process.env.VITEST !== "true") {
  buildHistoricalRealGold().then(({ paths, receipt }) => {
    process.stdout.write(JSON.stringify({
      status: "GI088_HISTORICAL_REAL_GOLD_V1_READY",
      privateHtml: paths.html,
      publicReceipt: paths.receipt,
      counts: receipt.counts,
      datasetFingerprint: receipt.datasetFingerprint
    }, null, 2) + "\n");
  }).catch((error) => {
    process.stderr.write((error instanceof Error ? error.stack ?? error.message : String(error)) + "\n");
    process.exitCode = 1;
  });
}
