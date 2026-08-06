import { createHash } from "node:crypto";

import { z } from "zod";

import datasetJson from "./board7a-six-case-v1.json";

export const BOARD7A_EVALUATION_ID = "board7a_real_output_ab_v1" as const;
export const BOARD7A_APPROVAL_VERSION = "2026-08-06.board7a-real-output-ab-approval-v1" as const;
export const BOARD7A_BUDGET_VERSION = "2026-08-06.board7a-real-output-ab-budget-v1" as const;
export const BOARD7A_PAIRING_SEED = "2026-08-06.board7a-real-output-ab-balanced-pairing-v1" as const;
export const BOARD7A_OUTPUT_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-06-board7a-real-output-ab-v1" as const;

export const BOARD7A_RUNTIME_CONFIG = {
  provider: "openai",
  baseUrlHost: "api.deepseek.com",
  model: "deepseek-v4-flash",
  temperature: 0.2,
  maxTokens: 1200,
  timeoutMs: 20_000,
  responseFormat: "json_object",
  thinking: "disabled"
} as const;

export const BOARD7A_REQUEST_BUDGET = {
  cases: 6,
  candidateARequestsPerCase: 1,
  candidateBRequestsPerCase: 2,
  nominalGenerationRequests: 18,
  technicalRetriesMax: 3,
  generationRequestsMax: 21,
  qualityRetries: 0
} as const;

export const BOARD7A_PROMPT_VERSIONS = {
  sharedPolicy: "2026-08-06.gi081-shared-product-policy-v1",
  candidateA: "2026-08-06.gi081-one-call-v1",
  candidateBSemantic: "2026-08-06.gi081-two-stage-semantic-v1",
  candidateBVisible: "2026-08-06.gi081-two-stage-visible-v1"
} as const;

const messageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1)
});

const caseSchema = z.object({
  id: z.enum(["H1", "H2", "H3", "T1", "T2", "T3"]),
  sourceKind: z.enum(["historical_preview", "target_rule_case"]),
  mode: z.enum(["help_record", "accompany_chat"]),
  stage: z.string().min(1),
  task: z.string().min(1),
  latestUserMessageId: z.string().min(1),
  messages: z.array(messageSchema).min(1),
  evaluationFocus: z.array(z.string().min(1)).min(1),
  hardBoundaries: z.array(z.string().min(1)).min(1),
  allowedActions: z.array(
    z.enum(["acknowledge", "ask", "synthesize", "pause"])
  ).min(1),
  source: z.record(z.unknown())
});

const datasetSchema = z.object({
  datasetVersion: z.literal("2026-08-06.board7a-real-output-six-case-v1"),
  purpose: z.string().min(1),
  modeDistribution: z.object({
    help_record: z.literal(2),
    accompany_chat: z.literal(4)
  }),
  sourcePolicy: z.object({
    historicalDatabase: z.literal(
      "happiness_board8_preview_20260804_gi066_fix_candidate_5_65_v3"
    ),
    databaseClass: z.literal("local_isolated_preview"),
    verifiedReadOnlyAt: z.string().datetime(),
    historicalStorageScope: z.literal("selected_user_visible_turns_only"),
    productionDataUsed: z.literal(false),
    syntheticReplacementAllowed: z.literal(false)
  }),
  cases: z.array(caseSchema).length(6)
});

export type Board7aCase = z.infer<typeof caseSchema>;
export type Board7aMode = Board7aCase["mode"];
export type Board7aArchitecture = "candidate_a" | "candidate_b";

export const BOARD7A_DATASET = datasetSchema.parse(datasetJson);
export const BOARD7A_CASES = BOARD7A_DATASET.cases;

function validateDatasetMatrix() {
  const ids = new Set(BOARD7A_CASES.map((item) => item.id));
  if (ids.size !== 6) throw new Error("BOARD7A_CASE_IDS_NOT_UNIQUE");
  const helpRecordCount = BOARD7A_CASES.filter(
    (item) => item.mode === "help_record"
  ).length;
  const accompanyChatCount = BOARD7A_CASES.length - helpRecordCount;
  if (helpRecordCount !== 2 || accompanyChatCount !== 4) {
    throw new Error("BOARD7A_MODE_DISTRIBUTION_INVALID");
  }
  const historicalCount = BOARD7A_CASES.filter(
    (item) => item.sourceKind === "historical_preview"
  ).length;
  if (historicalCount !== 3) throw new Error("BOARD7A_SOURCE_MIX_INVALID");
  for (const item of BOARD7A_CASES) {
    const messageIds = new Set(item.messages.map((message) => message.id));
    if (
      messageIds.size !== item.messages.length ||
      !messageIds.has(item.latestUserMessageId) ||
      item.messages.find((message) => message.id === item.latestUserMessageId)?.role !== "user"
    ) {
      throw new Error(`BOARD7A_CASE_CONTEXT_INVALID:${item.id}`);
    }
    if (
      item.mode === "help_record" &&
      JSON.stringify(item.allowedActions) !== JSON.stringify(["acknowledge"])
    ) {
      throw new Error(`BOARD7A_HELP_RECORD_ACTION_INVALID:${item.id}`);
    }
  }
}

validateDatasetMatrix();

export const BOARD7A_SHARED_PRODUCT_POLICY = `
你正在完成 Daily Light 生成式访谈的隔离离线评测。你只处理当前案例，不使用跨会话记忆、历史日志、外部工具或事实查询。

产品任务：
1. help_record（【帮我记】）：用户表达后只做轻量、忠实、自然的承接。不得提问、分析、建议、回答用户向 AI 提出的判断问题、邀请继续或切换模式。每轮只承接最新重点，避免完整复述全部材料。动作固定为 acknowledge。
2. accompany_chat（【陪我聊】）：基于完整有效语境判断此刻最有价值的动作。可以直接承接并形成认识、提出一个贴近体验且值得回答的问题，或在材料有限、用户拒绝、再次说不清时诚实暂停。

统一优先级：
- 明确停止、拒答、纠正和模式边界优先。
- 最新纠正覆盖被否定的旧事实、旧推断、旧焦点和旧问题前提。
- 只使用用户在当前案例中提供的内容。不得补写原因、动机、人格、长期模式或他人意图。
- 已经回答的内容不得换一种说法再次索取。
- 问题只有在回答可能实质改变当前理解时才值得提出；问题需要直接使用用户已给出的具体线索，并提供低负担入口。
- 正式问题最多一个。成果或暂停轮零问题，也不追加确认、选择或继续邀请。
- 用户可见语言需要自然、具体、克制；隐藏内部阶段、流程、分类和推理。

动作含义：
- acknowledge：忠实轻承接，零问题。
- ask：已有材料仍有一个会改变理解的关键缺口；用户可直接回答一个问题。
- synthesize：当前材料已经足够形成一条有来源、可纠正的认识；零问题。
- pause：继续推进价值有限，或用户已经要求停止；忠实保留当前范围并自然停住，零问题。

证据要求：evidenceRefs 只能填写输入消息中的 id。semanticSummary 只写简洁的当前理解结果，禁止输出逐步思考、隐含推理或内部分析过程。
`.trim();

export const BOARD7A_CANDIDATE_A_SYSTEM_PROMPT = `
${BOARD7A_SHARED_PRODUCT_POLICY}

你是候选 A：在一次模型调用中同时完成结构化语义判断和用户可见回应。

只输出一个合法 JSON 对象，禁止 Markdown 代码块。JSON 结构严格为：
{
  "semantic": {
    "action": "acknowledge | ask | synthesize | pause",
    "focus": "当前唯一焦点",
    "semanticSummary": "有来源的简洁当前理解",
    "evidenceRefs": ["输入消息 id"],
    "questionGoal": "ask 时填写，否则 null",
    "limitReason": "pause 时填写，否则 null"
  },
  "visible": {
    "understanding": "ask 时填写一段自然理解回应；其他动作填 null",
    "response": "给用户看的主回应；ask 时只放一个问题，其他动作零问题"
  }
}
`.trim();

export const BOARD7A_CANDIDATE_B_SEMANTIC_SYSTEM_PROMPT = `
${BOARD7A_SHARED_PRODUCT_POLICY}

你是候选 B 的第一阶段。你只形成可复核的语义结果，不写用户可见文案。

只输出一个合法 JSON 对象，禁止 Markdown 代码块。JSON 结构严格为：
{
  "action": "acknowledge | ask | synthesize | pause",
  "focus": "当前唯一焦点",
  "semanticSummary": "有来源的简洁当前理解",
  "evidenceRefs": ["输入消息 id"],
  "questionGoal": "ask 时填写，否则 null",
  "limitReason": "pause 时填写，否则 null"
}
`.trim();

export const BOARD7A_CANDIDATE_B_VISIBLE_SYSTEM_PROMPT = `
${BOARD7A_SHARED_PRODUCT_POLICY}

你是候选 B 的第二阶段。语义结果已经冻结，你只根据该结果和列出的用户原话证据生成用户可见回应。不得重新选择动作、改变焦点、补充证据或引入新判断。

只输出一个合法 JSON 对象，禁止 Markdown 代码块。JSON 结构严格为：
{
  "understanding": "ask 时填写一段自然理解回应；其他动作填 null",
  "response": "给用户看的主回应；ask 时只放一个问题，其他动作零问题"
}
`.trim();

const semanticSchema = z.object({
  action: z.enum(["acknowledge", "ask", "synthesize", "pause"]),
  focus: z.string().trim().min(1).max(300),
  semanticSummary: z.string().trim().min(1).max(600),
  evidenceRefs: z.array(z.string().min(1)).min(1).max(12),
  questionGoal: z.string().trim().min(1).max(400).nullable(),
  limitReason: z.string().trim().min(1).max(400).nullable()
});

const visibleSchema = z.object({
  understanding: z.string().trim().min(1).max(600).nullable(),
  response: z.string().trim().min(1).max(1000)
});

const oneCallSchema = z.object({
  semantic: semanticSchema,
  visible: visibleSchema
});

export type Board7aSemantic = z.infer<typeof semanticSchema>;
export type Board7aVisible = z.infer<typeof visibleSchema>;
export type Board7aOneCallPayload = z.infer<typeof oneCallSchema>;

export function parseJsonObjectContent(content: string) {
  const trimmed = content.trim();
  const normalized = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "")
    : trimmed;
  const parsed = JSON.parse(normalized) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("BOARD7A_PROVIDER_OUTPUT_NOT_JSON_OBJECT");
  }
  return parsed;
}

export function parseCandidateAOutput(content: string): Board7aOneCallPayload {
  return oneCallSchema.parse(parseJsonObjectContent(content));
}

export function parseCandidateBSemanticOutput(content: string): Board7aSemantic {
  return semanticSchema.parse(parseJsonObjectContent(content));
}

export function parseCandidateBVisibleOutput(content: string): Board7aVisible {
  return visibleSchema.parse(parseJsonObjectContent(content));
}

function questionMarkCount(text: string) {
  return [...text].filter((character) => character === "?" || character === "？").length;
}

export function validateCandidateOutput(input: {
  caseItem: Board7aCase;
  semantic: Board7aSemantic;
  visible: Board7aVisible;
}) {
  const issues: string[] = [];
  const messageIds = new Set(input.caseItem.messages.map((message) => message.id));
  if (new Set(input.semantic.evidenceRefs).size !== input.semantic.evidenceRefs.length) {
    issues.push("DUPLICATE_EVIDENCE_REFS");
  }
  for (const ref of input.semantic.evidenceRefs) {
    if (!messageIds.has(ref)) issues.push(`UNKNOWN_EVIDENCE_REF:${ref}`);
  }
  if (!input.caseItem.allowedActions.includes(input.semantic.action)) {
    issues.push(`ACTION_OUTSIDE_CASE_BOUNDARY:${input.semantic.action}`);
  }
  if (
    input.caseItem.mode === "help_record" &&
    input.semantic.action !== "acknowledge"
  ) {
    issues.push("HELP_RECORD_ACTION_MUST_ACKNOWLEDGE");
  }
  const visibleText = [input.visible.understanding, input.visible.response]
    .filter(Boolean)
    .join("\n");
  const questions = questionMarkCount(visibleText);
  if (input.semantic.action === "ask") {
    if (!input.semantic.questionGoal) issues.push("ASK_QUESTION_GOAL_REQUIRED");
    if (input.semantic.limitReason) issues.push("ASK_LIMIT_REASON_MUST_BE_NULL");
    if (!input.visible.understanding) issues.push("ASK_UNDERSTANDING_REQUIRED");
    if (questions !== 1) issues.push(`ASK_QUESTION_COUNT_INVALID:${questions}`);
  } else {
    if (input.semantic.questionGoal) issues.push("NON_ASK_QUESTION_GOAL_MUST_BE_NULL");
    if (input.visible.understanding) issues.push("NON_ASK_UNDERSTANDING_MUST_BE_NULL");
    if (questions !== 0) issues.push(`NON_ASK_QUESTION_COUNT_INVALID:${questions}`);
  }
  if (input.semantic.action === "pause") {
    if (!input.semantic.limitReason) issues.push("PAUSE_LIMIT_REASON_REQUIRED");
  } else if (input.semantic.limitReason) {
    issues.push("NON_PAUSE_LIMIT_REASON_MUST_BE_NULL");
  }
  return issues;
}

export function formatCaseContext(caseItem: Board7aCase) {
  return caseItem.messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content
  }));
}

export function createCandidateAUserPrompt(caseItem: Board7aCase) {
  return JSON.stringify({
    task: caseItem.task,
    mode: caseItem.mode,
    conversation: formatCaseContext(caseItem),
    latestUserMessageId: caseItem.latestUserMessageId
  }, null, 2);
}

export function createCandidateBSemanticUserPrompt(caseItem: Board7aCase) {
  return createCandidateAUserPrompt(caseItem);
}

export function createCandidateBVisibleUserPrompt(input: {
  caseItem: Board7aCase;
  semantic: Board7aSemantic;
}) {
  const byId = new Map(input.caseItem.messages.map((message) => [message.id, message]));
  const evidenceExcerpts = input.semantic.evidenceRefs.flatMap((ref) => {
    const message = byId.get(ref);
    return message ? [{ id: message.id, role: message.role, content: message.content }] : [];
  });
  return JSON.stringify({
    task: input.caseItem.task,
    mode: input.caseItem.mode,
    frozenSemantic: input.semantic,
    evidenceExcerpts
  }, null, 2);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createBoard7aPairing() {
  const ranked = [...BOARD7A_CASES].sort((left, right) =>
    sha256(`${BOARD7A_PAIRING_SEED}:${left.id}`).localeCompare(
      sha256(`${BOARD7A_PAIRING_SEED}:${right.id}`)
    )
  );
  return ranked.map((caseItem, index) => ({
    displayOrder: index + 1,
    caseId: caseItem.id,
    left: index % 2 === 0 ? "candidate_a" as const : "candidate_b" as const,
    right: index % 2 === 0 ? "candidate_b" as const : "candidate_a" as const
  }));
}

export function createBoard7aPackageScope() {
  return {
    evaluationId: BOARD7A_EVALUATION_ID,
    dataset: BOARD7A_DATASET,
    runtimeConfig: BOARD7A_RUNTIME_CONFIG,
    requestBudget: BOARD7A_REQUEST_BUDGET,
    promptVersions: BOARD7A_PROMPT_VERSIONS,
    prompts: {
      sharedPolicy: BOARD7A_SHARED_PRODUCT_POLICY,
      candidateA: BOARD7A_CANDIDATE_A_SYSTEM_PROMPT,
      candidateBSemantic: BOARD7A_CANDIDATE_B_SEMANTIC_SYSTEM_PROMPT,
      candidateBVisible: BOARD7A_CANDIDATE_B_VISIBLE_SYSTEM_PROMPT
    },
    pairingSeed: BOARD7A_PAIRING_SEED,
    pairing: createBoard7aPairing()
  };
}

export function createBoard7aPackageFingerprint() {
  return sha256(JSON.stringify(createBoard7aPackageScope()));
}

export type Board7aApproval = {
  approvalType: typeof BOARD7A_EVALUATION_ID;
  approvalVersion: typeof BOARD7A_APPROVAL_VERSION;
  decision: "approved";
  approvedBy: "product_owner";
  approvedAt: string;
  confirmationText: string;
  packageFingerprint: string;
  datasetVersion: typeof BOARD7A_DATASET.datasetVersion;
  caseIds: string[];
  model: typeof BOARD7A_RUNTIME_CONFIG.model;
  nominalGenerationRequests: typeof BOARD7A_REQUEST_BUDGET.nominalGenerationRequests;
  technicalRetriesMax: typeof BOARD7A_REQUEST_BUDGET.technicalRetriesMax;
};

const approvalSchema = z.object({
  approvalType: z.literal(BOARD7A_EVALUATION_ID),
  approvalVersion: z.literal(BOARD7A_APPROVAL_VERSION),
  decision: z.literal("approved"),
  approvedBy: z.literal("product_owner"),
  approvedAt: z.string().datetime(),
  confirmationText: z.string().trim().min(2).max(300),
  packageFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  datasetVersion: z.literal(BOARD7A_DATASET.datasetVersion),
  caseIds: z.array(z.string()).length(6),
  model: z.literal(BOARD7A_RUNTIME_CONFIG.model),
  nominalGenerationRequests: z.literal(
    BOARD7A_REQUEST_BUDGET.nominalGenerationRequests
  ),
  technicalRetriesMax: z.literal(BOARD7A_REQUEST_BUDGET.technicalRetriesMax)
});

export function validateBoard7aApproval(value: unknown): Board7aApproval {
  const approval = approvalSchema.parse(value);
  if (approval.packageFingerprint !== createBoard7aPackageFingerprint()) {
    throw new Error("BOARD7A_APPROVAL_SCOPE_FINGERPRINT_MISMATCH");
  }
  if (
    JSON.stringify(approval.caseIds) !==
    JSON.stringify(BOARD7A_CASES.map((item) => item.id))
  ) {
    throw new Error("BOARD7A_APPROVAL_CASE_IDS_MISMATCH");
  }
  return approval;
}

export function createPendingBoard7aBudget() {
  return {
    budgetVersion: BOARD7A_BUDGET_VERSION,
    status: "pending_approval" as const,
    packageFingerprint: createBoard7aPackageFingerprint(),
    datasetVersion: BOARD7A_DATASET.datasetVersion,
    model: BOARD7A_RUNTIME_CONFIG.model,
    nominalGenerationRequests: BOARD7A_REQUEST_BUDGET.nominalGenerationRequests,
    technicalRetriesMax: BOARD7A_REQUEST_BUDGET.technicalRetriesMax,
    generationRequestsMax: BOARD7A_REQUEST_BUDGET.generationRequestsMax,
    generationRequestsUsed: 0,
    technicalRetriesUsed: 0,
    qualityRetriesUsed: 0,
    approval: null,
    reservation: null
  };
}

export type Board7aCandidateResult = {
  architecture: Board7aArchitecture;
  technicalComplete: boolean;
  semantic: Board7aSemantic | null;
  visible: Board7aVisible | null;
  validationIssues: string[];
  callIds: string[];
  technicalError: string | null;
};

export function renderBoard7aVisible(visible: Board7aVisible | null) {
  if (!visible) return "（技术失败，本候选没有生成可评审回应）";
  return [visible.understanding, visible.response].filter(Boolean).join("\n\n");
}

export function formatBoard7aBlindReview(input?: {
  results: Record<string, Partial<Record<Board7aArchitecture, Board7aCandidateResult>>>;
}) {
  const lines = [
    "# 板块 7A｜六题真实输出 A/B 盲评",
    "",
    `版本：\`${BOARD7A_DATASET.datasetVersion}\``,
    "",
    "填写说明：只依据用户任务、完整语境和两段用户可见回应作出判断。架构身份、结构化语义和 Codex 初评在完成盲评后揭晓。",
    "",
    "每题填写：`回应甲更好 / 回应乙更好 / 两者相当`；并分别判断 `可直接使用 / 轻微问题 / 质量失败 / 单例阻断`。",
    "",
    "---"
  ];
  const casesById = new Map(BOARD7A_CASES.map((item) => [item.id, item]));
  for (const pairing of createBoard7aPairing()) {
    const caseItem = casesById.get(pairing.caseId)!;
    const caseResults = input?.results[caseItem.id];
    const left = caseResults?.[pairing.left];
    const right = caseResults?.[pairing.right];
    lines.push(
      "",
      `## 第 ${pairing.displayOrder} 题｜${caseItem.id}`,
      "",
      `- 用户任务：${caseItem.task}`,
      `- 模式：${caseItem.mode === "help_record" ? "【帮我记】" : "【陪我聊】"}`,
      "",
      "### 完整语境",
      "",
      ...caseItem.messages.flatMap((message) => [
        `**${message.role === "user" ? "用户" : "AI"}：**`,
        "",
        `> ${message.content.replace(/\n/gu, "\n> ")}`,
        ""
      ]),
      "### 回应甲",
      "",
      `> ${(left ? renderBoard7aVisible(left.visible) : "（模型运行后写入）").replace(/\n/gu, "\n> ")}`,
      "",
      "### 回应乙",
      "",
      `> ${(right ? renderBoard7aVisible(right.visible) : "（模型运行后写入）").replace(/\n/gu, "\n> ")}`,
      "",
      "### 产品负责人裁决",
      "",
      "- 相对判断：",
      "- 回应甲绝对判断：",
      "- 回应乙绝对判断：",
      "- 理由：",
      "",
      "---"
    );
  }
  return `${lines.join("\n")}\n`;
}

export function createBoard7aReveal() {
  return {
    evaluationId: BOARD7A_EVALUATION_ID,
    datasetVersion: BOARD7A_DATASET.datasetVersion,
    packageFingerprint: createBoard7aPackageFingerprint(),
    pairingSeed: BOARD7A_PAIRING_SEED,
    revealAfter: "product_owner_blind_review_complete",
    pairing: createBoard7aPairing()
  };
}
