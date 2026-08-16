/* eslint-disable @typescript-eslint/no-explicit-any -- isolated evidence imports preserve heterogeneous historical JSON shapes */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, any>;

export type TranscriptMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isTarget?: boolean;
  deliveryStatus?: "visible_to_user" | "generated_but_program_blocked";
};

export type ReviewableConversation = {
  reviewId: string;
  sourceCaseId: string;
  title: string;
  productMode: "chat";
  evaluationUnit: "local_action";
  transcript: TranscriptMessage[];
  targetResponse: string;
  deliveryStatus: "visible_to_user" | "generated_but_program_blocked";
  technicalStatus: string;
  validationIssues: string[];
  historicalGold: string;
  historicalGoldOwner: string;
  originalRunReview: {
    label: string;
    reason: string;
    reviewedAt: string | null;
  };
  currentGoldRationale: {
    whyAdded: string;
    expectedBehavior: string;
    prohibitedBehavior: string[];
  };
  sourceIdentity: Json;
  knownLimitation: string;
  linkedAssetIds: string[];
  conversationFingerprint: string;
  sourceFingerprints: Json;
};

const VERSION = "2026-08-16.gi088-real-conversation-review-v2";
const ROOT = "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";

const GI088_CASES = [
  { caseId: "JC-QF-03", branchId: "2ca8be12-57a1-496f-8be8-eb1972321091", targetTurn: 1, links: ["DEV-HBC-01"] },
  { caseId: "JC-QF-04", branchId: "2731a87f-5b89-4caf-9afa-d3116aa0a257", targetTurn: 1, links: ["DEV-HBC-07"] },
  { caseId: "JC-QF-05", branchId: "b71f97a2-3036-46b5-9fce-ab97c1a0c891", targetTurn: 1, links: ["DEV-HBC-08"] },
  { caseId: "JC-SB-06", branchId: "3f125523-d69a-4114-af1b-b8a688777fa8", targetTurn: 2, links: [] },
  { caseId: "JC-SB-03", branchId: "917f336b-ab89-4e2a-979c-2b93aeb0fb8a", targetTurn: 0, links: ["DEV-HBC-02"] },
  { caseId: "JC-MI-05", branchId: "6bcbf9d1-b82b-4fdc-a606-05a7153a5c4a", targetTurn: 0, links: [] }
] as const;

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Json)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)])
  );
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

function normalize(text: unknown) {
  return String(text ?? "")
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'")
    .replace(/\s+/gu, "")
    .replace(/[，。！？：；、,.!?:;]/gu, "");
}

function visibleText(value: Json) {
  const understanding = String(value?.understanding ?? "").trim();
  const response = String(value?.response ?? "").trim();
  return [understanding, response].filter(Boolean).join("\n\n");
}

function titleOf(card: Json) {
  return String(card.title ?? card.caseId);
}

function sourceCardMap(judge: Json) {
  return new Map<string, Json>((judge.cards ?? []).map((item: Json) => [item.caseId, item]));
}

function branchById(snapshot: Json, branchId: string) {
  for (const task of snapshot.record.state.tasks as Json[]) {
    for (const branch of Object.values(task.branches ?? {}) as Json[]) {
      if (branch.id === branchId) return { task, branch };
    }
  }
  throw new Error(`GI088_BRANCH_NOT_FOUND:${branchId}`);
}

function buildBranchTranscript(task: Json, branch: Json, targetTurnIndex: number) {
  const turn = branch.turns[targetTurnIndex] as Json;
  if (!turn?.visibleText) throw new Error(`GI088_TARGET_OUTPUT_MISSING:${branch.id}:${targetTurnIndex}`);
  const userId = String(turn.userMessageId);
  const sourceMessages = (branch.messages ?? []) as Json[];
  const transcript: TranscriptMessage[] = [];
  let foundUser = false;
  let foundTarget = false;

  for (const message of sourceMessages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    transcript.push({ id: String(message.id), role: message.role, content: String(message.content) });
    if (message.id === userId) foundUser = true;
    if (message.role === "assistant" && normalize(message.content) === normalize(turn.visibleText)) {
      transcript[transcript.length - 1].isTarget = true;
      transcript[transcript.length - 1].deliveryStatus = "visible_to_user";
      foundTarget = true;
    }
  }

  if (!foundUser) {
    const excerpt = (turn.evidenceExcerpts ?? []).find((item: Json) => item.id === userId);
    if (!excerpt) throw new Error(`GI088_TARGET_USER_MISSING:${branch.id}:${userId}`);
    transcript.push({ id: userId, role: "user", content: String(excerpt.content) });
  }

  const deliveryStatus: ReviewableConversation["deliveryStatus"] = foundTarget ? "visible_to_user" : "generated_but_program_blocked";
  if (!foundTarget) {
    transcript.push({
      id: `target-${turn.id}`,
      role: "assistant",
      content: String(turn.visibleText),
      isTarget: true,
      deliveryStatus
    });
  }

  const call = (turn.calls ?? []).at(-1) as Json;
  return { transcript, turn, call, deliveryStatus };
}

function rationale(card: Json) {
  return {
    whyAdded: String(card.whyAdded ?? ""),
    expectedBehavior: String(card.expectedBehavior ?? ""),
    prohibitedBehavior: (card.prohibitedBehavior ?? []).map(String)
  };
}

function finalCase(input: Omit<ReviewableConversation, "reviewId" | "conversationFingerprint">, index: number) {
  const fingerprint = sha(canonicalJson({
    transcript: input.transcript,
    targetResponse: input.targetResponse,
    sourceIdentity: input.sourceIdentity
  }));
  return {
    ...input,
    reviewId: `RC-${String(index + 1).padStart(2, "0")}`,
    conversationFingerprint: fingerprint
  } satisfies ReviewableConversation;
}

function ensureActualOutput(conversation: ReviewableConversation) {
  const users = conversation.transcript.filter((message) => message.role === "user");
  const targets = conversation.transcript.filter((message) => message.role === "assistant" && message.isTarget);
  if (!users.length || targets.length !== 1 || !conversation.targetResponse.trim()) {
    throw new Error(`GI088_REVIEWABLE_EVIDENCE_INCOMPLETE:${conversation.sourceCaseId}`);
  }
  if (normalize(targets[0].content) !== normalize(conversation.targetResponse)) {
    throw new Error(`GI088_TARGET_RESPONSE_MISMATCH:${conversation.sourceCaseId}`);
  }
  if (!conversation.sourceIdentity.candidateVersion || !conversation.sourceIdentity.runId) {
    throw new Error(`GI088_SOURCE_IDENTITY_INCOMPLETE:${conversation.sourceCaseId}`);
  }
}

export async function buildRealConversationPacket(cwd = process.cwd()) {
  const assetRoot = path.join(cwd, ROOT);
  const privateRoot = path.join(assetRoot, ".private/real-conversation-review-v2");
  const paths = {
    template: path.join(cwd, "scripts/gi088-real-conversation-review-template.html"),
    hard: path.join(assetRoot, "hard-boundary-regression-24.json"),
    development: path.join(assetRoot, "development-challenge-28.json"),
    hidden: path.join(assetRoot, ".private/independent-admission-v2/hidden-cases.json"),
    judge: path.join(assetRoot, "judge-calibration-20.json"),
    gi086: path.join(cwd, "artifacts/local-runtime/generative-interview-board7/2026-08-07-board7b-thinking-capability-v1/probe-627da7ad0cea7b00b222d69ec5762718941fcf986bd8962af67bdb8ee9fadee0/raw-results.json"),
    gi086Review: path.join(cwd, "artifacts/generative-interview-board7/2026-08-07-board7b-thinking-capability-v1/board7b-thinking-capability-v1-transparent-review.md"),
    board7Dataset: path.join(cwd, "evals/event-centered-generative/board7a-real-output/board7a-six-case-v1.json"),
    board7Run: path.join(cwd, "artifacts/generative-interview-board7/2026-08-06-board7a-real-output-ab-v1/board7a-six-case-ab-v1-run.json"),
    board7Review: path.join(cwd, "artifacts/generative-interview-board7/2026-08-06-board7a-real-output-ab-v1/board7a-six-case-ab-v1-blind-review-run.md"),
    gi088v1: path.join(cwd, "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-readonly-db-snapshot.json"),
    gi088v8: path.join(cwd, "artifacts/local-runtime/gi088-v8r1-pre-v8r2-baseline-20260810.json"),
    packet: path.join(privateRoot, "review-packet.json"),
    decisions: path.join(privateRoot, "review-decisions.json"),
    summary: path.join(privateRoot, "review-summary.json"),
    html: path.join(privateRoot, "index.html"),
    receipt: path.join(assetRoot, "real-conversation-review-v2-receipt.json")
  };

  const [hard, development, hidden, judge, gi086, board7Dataset, board7Run, gi088v1, gi088v8, template] = await Promise.all([
    json(paths.hard), json(paths.development), json(paths.hidden), json(paths.judge), json(paths.gi086),
    json(paths.board7Dataset), json(paths.board7Run), json(paths.gi088v1), json(paths.gi088v8), readFile(paths.template, "utf8")
  ]);
  const cards = sourceCardMap(judge);
  const conversations: Array<Omit<ReviewableConversation, "reviewId" | "conversationFingerprint">> = [];

  const gi086Config = [
    { caseId: "JC-DU-03", pairId: "P1", arm: "thinking_disabled", links: [] },
    { caseId: "JC-DU-04", pairId: "P1", arm: "thinking_high", links: [] },
    { caseId: "JC-DU-05", pairId: "P2", arm: "thinking_disabled", links: [] }
  ];
  for (const config of gi086Config) {
    const card = cards.get(config.caseId)!;
    const call = (gi086.calls as Json[]).find((item) => item.pairId === config.pairId && item.arm === config.arm)!;
    const target = visibleText(call.output.visible);
    const deliveryStatus = call.status === "protected_failure" ? "generated_but_program_blocked" : "visible_to_user";
    const transcript: TranscriptMessage[] = [
      ...call.modelInput.conversation.map((message: Json) => ({ id: String(message.id), role: message.role, content: String(message.content) })),
      { id: `${config.pairId}-${config.arm}-target`, role: "assistant", content: target, isTarget: true, deliveryStatus }
    ];
    conversations.push({
      sourceCaseId: config.caseId,
      title: titleOf(card), productMode: "chat", evaluationUnit: "local_action", transcript,
      targetResponse: target, deliveryStatus, technicalStatus: String(call.status),
      validationIssues: (call.validationIssues ?? []).map(String), historicalGold: String(card.goldLabel),
      historicalGoldOwner: String(card.goldOwner),
      originalRunReview: { label: "direct_use", reason: "原评审记录未填写理由。", reviewedAt: null },
      currentGoldRationale: rationale(card),
      sourceIdentity: {
        sourceFile: path.relative(cwd, paths.gi086), sourceReview: path.relative(cwd, paths.gi086Review),
        locator: `${config.pairId} / ${config.arm}`, evaluationId: gi086.evaluationId,
        candidateVersion: gi086.candidateVersion, candidateFingerprint: gi086.candidateFingerprint,
        executionFingerprint: gi086.executionFingerprint, runId: gi086.runFingerprint,
        requestHash: call.requestHash, responseHash: call.responseHash, model: call.runtimeConfig?.model ?? call.provider
      },
      knownLimitation: "这是固定历史语境下的单个局部回应，只能判断该动作，不能代表完整开放式对话体验。",
      linkedAssetIds: config.links,
      sourceFingerprints: { rawRun: await fileSha(paths.gi086), productReview: await fileSha(paths.gi086Review) }
    });
  }

  const h1 = (board7Dataset.cases as Json[]).find((item) => item.id === "H1")!;
  const h1Run = (board7Run.runs as Json[]).find((item) => item.caseId === "H1")!;
  const board7Reason = "用户说的这句话其实是对 AI 上一个问题的否定。AI 是让他去区分爽和轻松，但用户是在否认 AI 的一个提问逻辑，用户要表达的是，这两者是并存的，是需要 AI 去调整他们提问，而不是 AI 再去回应用户。这个地方我很好奇，你是怎么给 AI 去做评测的？是直接把上下文给到 AI，然后把这个题目给到 AI，让 AI 去回答用户的问题吗？更正确的方式应该是让 AI 全程去参与上下文吧，而不是基于预设的上下文去给 AI，让它去回答用户的问题。因为预设的上下文里面的 AI 那部分的提问并不是现有 AI 的提问。使用现有 AI 的话去参与全过程，可能上下文是完全不一样的。就根本不会出现这个题目。题目都不存在的话，那它的评分就没有意义了。";
  for (const config of [
    { caseId: "JC-QF-01", key: "candidateA", promptVersion: board7Run.promptVersions.candidateA, links: ["DEV-HBC-05"] },
    { caseId: "JC-QF-02", key: "candidateB", promptVersion: board7Run.promptVersions.candidateBVisible, links: ["DEV-HBC-06"] }
  ]) {
    const card = cards.get(config.caseId)!;
    const result = h1Run[config.key];
    const target = visibleText(result.visible);
    const transcript: TranscriptMessage[] = [
      ...h1.messages.map((message: Json) => ({ id: String(message.id), role: message.role, content: String(message.content) })),
      { id: `${config.caseId}-target`, role: "assistant", content: target, isTarget: true, deliveryStatus: "visible_to_user" }
    ];
    conversations.push({
      sourceCaseId: config.caseId, title: titleOf(card), productMode: "chat", evaluationUnit: "local_action",
      transcript, targetResponse: target, deliveryStatus: "visible_to_user",
      technicalStatus: result.technicalComplete ? "valid" : "technical_incomplete",
      validationIssues: (result.validationIssues ?? []).map(String), historicalGold: String(card.goldLabel),
      historicalGoldOwner: String(card.goldOwner),
      originalRunReview: { label: "quality_failure", reason: board7Reason, reviewedAt: null },
      currentGoldRationale: rationale(card),
      sourceIdentity: {
        sourceFile: path.relative(cwd, paths.board7Run), datasetFile: path.relative(cwd, paths.board7Dataset),
        sourceReview: path.relative(cwd, paths.board7Review), locator: `H1 / ${config.key}`,
        evaluationId: board7Run.evaluationId, candidateVersion: config.promptVersion,
        candidateFingerprint: board7Run.packageFingerprint, executionFingerprint: board7Run.packageFingerprint,
        runId: board7Run.evaluationId, callIds: result.callIds,
        requestHashes: (board7Run.calls as Json[]).filter((call) => result.callIds.includes(call.callId)).map((call) => call.requestHash),
        responseHashes: (board7Run.calls as Json[]).filter((call) => result.callIds.includes(call.callId)).map((call) => call.responseHash),
        model: board7Run.runtimeConfig.model
      },
      knownLimitation: "前序 AI 对话来自冻结历史语境，候选只生成最后一个局部回应。它适合审局部纠正动作，不能证明候选会自行走到同一上下文。",
      linkedAssetIds: config.links,
      sourceFingerprints: { dataset: await fileSha(paths.board7Dataset), rawRun: await fileSha(paths.board7Run), productReview: await fileSha(paths.board7Review) }
    });
  }

  for (const config of GI088_CASES) {
    const card = cards.get(config.caseId)!;
    const { task, branch } = branchById(gi088v1, config.branchId);
    const built = buildBranchTranscript(task, branch, config.targetTurn);
    conversations.push({
      sourceCaseId: config.caseId, title: titleOf(card), productMode: "chat", evaluationUnit: "local_action",
      transcript: built.transcript, targetResponse: String(built.turn.visibleText), deliveryStatus: built.deliveryStatus,
      technicalStatus: String(built.turn.status), validationIssues: (built.turn.validationIssues ?? []).map(String),
      historicalGold: String(card.goldLabel), historicalGoldOwner: String(card.goldOwner),
      originalRunReview: { label: String(branch.review?.quality ?? "unreviewed"), reason: String(branch.review?.reason ?? "原评审记录未填写理由。"), reviewedAt: branch.review?.reviewedAt ?? null },
      currentGoldRationale: rationale(card),
      sourceIdentity: {
        sourceFile: path.relative(cwd, paths.gi088v1), locator: `${task.taskId} / ${branch.branch} / turn ${config.targetTurn + 1}`,
        evaluationId: gi088v1.record.evaluationVersion, candidateVersion: gi088v1.record.evaluationVersion,
        candidateFingerprint: gi088v1.record.candidateFingerprint, executionFingerprint: gi088v1.record.executionFingerprint,
        runId: gi088v1.record.id, branchId: branch.id, callId: built.call?.id,
        requestHash: built.call?.requestHash, responseHash: built.call?.responseHash,
        model: built.call?.providerDiagnostics?.responseModel ?? "historical_provider_snapshot"
      },
      knownLimitation: built.deliveryStatus === "visible_to_user"
        ? "这是历史完整分支中的一个目标动作；评审卡突出该回答，完整轨迹价值仍需另设轨迹级证据。"
        : "模型生成了这段回答，程序在交付前拦截。可评内容质量，同时要把用户未实际看到的交付事实单独记账。",
      linkedAssetIds: [...config.links],
      sourceFingerprints: { rawRun: await fileSha(paths.gi088v1) }
    });
  }

  const v8Task = (gi088v8.batch.state.tasks as Json[]).find((item) => item.taskId === "A1")!;
  const v8Branch = v8Task.branches.high;
  const v8Built = buildBranchTranscript(v8Task, v8Branch, 0);
  const v8Card = cards.get("JC-SB-05")!;
  conversations.push({
    sourceCaseId: "JC-SB-05", title: titleOf(v8Card), productMode: "chat", evaluationUnit: "local_action",
    transcript: v8Built.transcript, targetResponse: String(v8Built.turn.visibleText), deliveryStatus: v8Built.deliveryStatus,
    technicalStatus: String(v8Built.turn.status), validationIssues: (v8Built.turn.validationIssues ?? []).map(String),
    historicalGold: String(v8Card.goldLabel), historicalGoldOwner: String(v8Card.goldOwner),
    originalRunReview: { label: String(v8Branch.review.quality), reason: String(v8Branch.review.reason), reviewedAt: v8Branch.review.reviewedAt },
    currentGoldRationale: rationale(v8Card),
    sourceIdentity: {
      sourceFile: path.relative(cwd, paths.gi088v8), locator: "A1 / high / turn 1",
      evaluationId: gi088v8.batch.evaluationVersion, candidateVersion: gi088v8.batch.evaluationVersion,
      candidateFingerprint: gi088v8.batch.candidateFingerprint, executionFingerprint: gi088v8.batch.executionFingerprint,
      runId: gi088v8.batch.id, branchId: v8Branch.id, callId: v8Built.call.id,
      requestHash: v8Built.call.requestHash, responseHash: v8Built.call.responseHash,
      model: v8Built.call.providerDiagnostics?.responseModel ?? "deepseek-v4-pro"
    },
    knownLimitation: "这是一轮真实历史输出，能判断误停动作；完整产品体验仍需多轮轨迹和真人反馈补证。",
    linkedAssetIds: ["DEV-HBC-03", "HB-UC-04"],
    sourceFingerprints: { rawRun: await fileSha(paths.gi088v8) }
  });

  const reviewableCases = conversations.map(finalCase);
  reviewableCases.forEach(ensureActualOutput);
  if (reviewableCases.length !== 12) throw new Error(`GI088_REVIEWABLE_COUNT_MISMATCH:${reviewableCases.length}`);

  const priorVitest = process.env.VITEST;
  process.env.VITEST = "true";
  const { buildReviewItems } = await import("./prepare-gi088-evaluation-asset-review");
  if (priorVitest === undefined) delete process.env.VITEST;
  else process.env.VITEST = priorVitest;
  const originalAssets = buildReviewItems({ hard, development, hidden });
  const linkedIds = new Set(reviewableCases.flatMap((item) => item.linkedAssetIds));
  const outOfScopeAssets = originalAssets
    .filter((item) => item.productMode === "capture" || item.productMode === "mixed")
    .map((item) => ({ assetId: item.sourceCaseId, assetGroup: item.assetGroup, title: item.title, mode: item.productMode, reason: "当前产品审题范围只计算【陪我聊】。" }));
  const outIds = new Set(outOfScopeAssets.map((item) => item.assetId));
  const pendingAssets = originalAssets
    .filter((item) => !linkedIds.has(item.sourceCaseId) && !outIds.has(item.sourceCaseId))
    .map((item) => {
      const hiddenV2 = item.assetGroup === "hidden_v2";
      const preview = item.assetGroup === "preview_4_plus_2";
      const missingEvidence = hiddenV2
        ? ["AI 真实回答", "来源候选和运行记录", "历史人工结论"]
        : preview
          ? ["完整真实轨迹", "AI 真实回答", "来源候选和运行记录", "历史人工结论"]
          : ["可重放的完整必要上下文", "AI 真实回答", "来源候选和运行记录", "历史人工结论"];
      return {
        assetId: item.sourceCaseId, assetGroup: item.assetGroup, title: item.title,
        mode: item.productMode === "unspecified" ? "chat_scope_expected_mode_field_missing" : item.productMode,
        existingMaterial: ["场景摘要", "预期行为", "禁区", "来源目录"],
        missingEvidence,
        whyBlocked: hiddenV2 ? "私有题目已经编写，但当前候选尚未运行。" : preview ? "当前只有验收蓝图，尚未形成真实 Preview 轨迹。" : "当前目录无法还原一份带真实模型回答的完整历史运行。",
        linkedReviewableIds: []
      };
    });

  if (originalAssets.length !== 70 || pendingAssets.length !== 54 || outOfScopeAssets.length !== 8 || linkedIds.size !== 8) {
    throw new Error(`GI088_SCOPE_COUNTS_MISMATCH:${originalAssets.length}/${pendingAssets.length}/${outOfScopeAssets.length}/${linkedIds.size}`);
  }

  const packetCore = {
    schemaVersion: "2.0", packageVersion: VERSION,
    purpose: "由产品负责人检查真实历史用户—AI 对话及其历史金标，判断是否适合进入正式评测资产。",
    supportedDecision: "逐份决定保留、修改金标、补充上下文、转开发探索、退出替换或等待产品规则决定。",
    unsupportedDecisions: ["当前候选质量", "Judge 资格", "独立准入", "真人 Preview 结果", "发布资格"],
    currentProductScope: "accompany_me_chat",
    historicalV1Status: "withdrawn_incomplete_real_conversation_evidence",
    counts: { originalAssets: 70, reviewableConversations: 12, coveredOriginalAssets: 8, pendingOriginalAssets: 54, outOfScopeOriginalAssets: 8 },
    reviewableCases, pendingAssets, outOfScopeAssets
  };
  const reviewPacketFingerprint = sha(canonicalJson(packetCore));
  const generatedAt = new Date().toISOString();
  const packet = { ...packetCore, reviewPacketFingerprint, generatedAt };
  const decisions = { schemaVersion: "2.0", packageVersion: VERSION, reviewPacketFingerprint, status: "draft", answers: {}, revisions: {} };
  const summary = { schemaVersion: "2.0", packageVersion: VERSION, reviewPacketFingerprint, status: "waiting_product_owner_review", counts: packetCore.counts, reviewedCount: 0, completionGate: "12_of_12_real_conversations_adjudicated" };
  if (!template.includes("__GI088_REAL_CONVERSATION_PACKET__")) throw new Error("GI088_V2_TEMPLATE_PLACEHOLDER_MISSING");
  const html = template.replace("__GI088_REAL_CONVERSATION_PACKET__", JSON.stringify(packet).replaceAll("<", "\\u003c"));

  await mkdir(privateRoot, { recursive: true });
  await Promise.all([
    writeFile(paths.packet, JSON.stringify(packet, null, 2) + "\n"),
    writeFile(paths.decisions, JSON.stringify(decisions, null, 2) + "\n"),
    writeFile(paths.summary, JSON.stringify(summary, null, 2) + "\n"),
    writeFile(paths.html, html)
  ]);
  const receipt = {
    schemaVersion: "2.0", receiptVersion: VERSION, generatedAt,
    status: "real_conversation_review_pack_ready_waiting_product_owner",
    counts: packetCore.counts,
    qualityChecks: {
      reviewableWithUserUtterance: 12, reviewableWithActualAiOutput: 12,
      completeRunAndCandidateIdentity: 12, summariesOrBlueprintsInReviewable: 0,
      outOfScopeInReviewable: 0, humanWrittenReferenceAnswersInReviewable: 0,
      externalRequests: 0, modelCalls: 0, judgeCalls: 0, databaseChanges: 0, previewChanges: 0, productionChanges: 0
    },
    reviewPacketFingerprint, privateHtmlFingerprint: sha(html),
    publicContentBoundary: { userUtterances: 0, aiResponses: 0, hiddenV2Bodies: 0, productOwnerDecisions: 0 },
    conclusionBoundary: { supported: packetCore.supportedDecision, unsupported: packetCore.unsupportedDecisions }
  };
  await writeFile(paths.receipt, JSON.stringify(receipt, null, 2) + "\n");
  return { paths, packet, receipt };
}

if (process.env.VITEST !== "true") {
  buildRealConversationPacket().then(({ paths, receipt }) => {
    process.stdout.write(JSON.stringify({ status: "GI088_REAL_CONVERSATION_REVIEW_V2_READY", privateHtml: paths.html, publicReceipt: paths.receipt, counts: receipt.counts, reviewPacketFingerprint: receipt.reviewPacketFingerprint }, null, 2) + "\n");
  }).catch((error) => {
    process.stderr.write((error instanceof Error ? error.stack ?? error.message : String(error)) + "\n");
    process.exitCode = 1;
  });
}
