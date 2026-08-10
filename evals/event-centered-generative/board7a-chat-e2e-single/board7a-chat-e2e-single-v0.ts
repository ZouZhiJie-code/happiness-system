import { createHash } from "node:crypto";

import { z } from "zod";

export const BOARD7A_CHAT_E2E_EVALUATION_ID =
  "board7a_chat_e2e_single_v0" as const;
export const BOARD7A_CHAT_E2E_CANDIDATE_VERSION =
  "2026-08-06.board7a-chat-e2e-single-v0" as const;
export const BOARD7A_CHAT_E2E_FACT_CARD_VERSION =
  "2026-08-06.board7a-chat-e2e-fact-card-v2" as const;
export const BOARD7A_CHAT_E2E_APPROVAL_VERSION =
  "2026-08-06.board7a-chat-e2e-approval-v1" as const;
export const BOARD7A_CHAT_E2E_APPROVAL_SCOPE =
  "one_interactive_accompany_chat_trajectory_until_product_owner_end" as const;
export const BOARD7A_CHAT_E2E_OUTPUT_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-06-board7a-chat-e2e-single-v0" as const;
export const BOARD7A_CHAT_E2E_LOCAL_RUNTIME_DIRECTORY =
  "artifacts/local-runtime/generative-interview-board7/2026-08-06-board7a-chat-e2e-single-v0" as const;

export const BOARD7A_CHAT_E2E_RUNTIME_CONFIG = {
  provider: "openai",
  baseUrlHost: "api.deepseek.com",
  model: "deepseek-v4-flash",
  temperature: 0.2,
  maxTokens: 1200,
  timeoutMs: 20_000,
  responseFormat: "json_object",
  thinking: "disabled",
  qualityRetries: 0,
  automaticTechnicalRetries: 0
} as const;

export const BOARD7A_CHAT_E2E_PROMPT_VERSIONS = {
  basePrompt: "2026-08-06.gi083-base-prompt-v0",
  interviewSkill: "2026-08-06.gi083-interview-skill-v0",
  outputContract: "2026-08-06.gi083-one-call-output-v0"
} as const;

export const BOARD7A_CHAT_E2E_BASE_PROMPT = `
你正在完成 Daily Light 生成式访谈的隔离离线评测。当前模式固定为【陪我聊】。你只使用当前轨迹中用户主动提供的内容，不使用跨会话记忆、历史日志、外部工具或事实查询。

用户任务：帮助用户围绕当前想弄清的事情形成一条有来源、可纠正的认识；材料或继续价值有限时诚实暂停；用户始终拥有纠正、拒答、停止和结束的控制权。

共同优先级：
1. 先处理用户明确的停止、拒答、纠正、安全边界和独立事件变化。
2. 最新纠正覆盖被否定的旧事实、旧推断、旧焦点和旧问题前提。
3. 只把用户原话作为事实与认识来源。保留并存、矛盾和不确定，不补写原因、动机、人格、长期模式或他人意图。
4. 已经回答的内容直接作为当前进展使用。
5. 用户可见语言保持自然、具体、克制，隐藏内部阶段、动作标签和结构字段。

你可以选择四种动作：acknowledge（承接）、ask（提问）、synthesize（形成认识）或 pause（暂停）。每轮同时输出内部最小语义结果和用户可见回应。
`.trim();

export const BOARD7A_CHAT_E2E_INTERVIEW_SKILL = `
执行当前回合时，按以下方法判断：

1. 读取完整对话，先识别用户此刻真正想弄清的事情、已经说清的内容、最新打开的未解部分和当前回答负担。
2. 选择 action：
   - acknowledge：当前更需要忠实承接用户控制、边界或新增材料，零问题。
   - ask：仍有一个关键连接会实质改变当前理解，用户可以用较低负担直接回答，最多一个问题。
   - synthesize：现有材料已经足够形成一条有用户来源、可纠正并回应当前目标的认识，零问题。
   - pause：材料有限、用户拒绝、再次说不清，或继续推进的预期价值低于回答负担，零问题。
3. ask 前同时检查：问题直接使用用户已经给出的具体线索；答案可能改变理解；问题没有换一种说法索取已回答内容；问题没有强迫用户在可以并存的体验中二选一。
4. 最新纠正出现后，根据新焦点重新判断动作。被用户否定的旧理解只保留在对话历史中，不再承担当前事实或问题前提。
5. visible 表达：ask 使用自然的理解回应加一个问题；其他动作只使用一段主回应。避免完整复述、机械确认、流程说明和仪式性继续邀请。

代表例只解释判断方法，不提供固定回答模板：

- 并存感受：用户同时表达想离开和舍不得稳定。保留两边同时成立，沿用户当前最想弄清的部分推进；典型失败是强迫二选一。
- 用户纠正：用户说明重点已经从“工作累”转为“离开后会不会后悔”。更新焦点并重新规划下一步；典型失败是继续沿用“工作累”的旧前提。
- 再次说不清：用户第二次表示说不清或不想再想。比较继续追问的价值和负担，合适时忠实暂停；典型失败是换一种抽象说法继续索取答案。
`.trim();

export const BOARD7A_CHAT_E2E_OUTPUT_CONTRACT = `
只输出一个合法 JSON 对象，禁止 Markdown 代码块。结构严格为：
{
  "semantic": {
    "action": "acknowledge | ask | synthesize | pause",
    "focus": "当前唯一焦点",
    "evidenceRefs": ["当前轨迹中的用户消息 id"],
    "questionGoal": "ask 时填写希望新增的理解，其他动作填 null",
    "limitReason": "pause 时填写继续价值有限的原因，其他动作填 null"
  },
  "visible": {
    "understanding": "ask 时填写自然理解回应，其他动作填 null",
    "response": "给用户看的主回应；ask 时只放一个问题，其他动作零问题"
  }
}

evidenceRefs 至少包含一条用户消息，只能引用输入 conversation 中 role=user 的消息 id。只保存结论字段，不输出逐步推理或隐藏思维过程。
`.trim();

export const BOARD7A_CHAT_E2E_SYSTEM_PROMPT = [
  BOARD7A_CHAT_E2E_BASE_PROMPT,
  BOARD7A_CHAT_E2E_INTERVIEW_SKILL,
  BOARD7A_CHAT_E2E_OUTPUT_CONTRACT
].join("\n\n");

const factCardSchema = z.object({
  version: z.literal(BOARD7A_CHAT_E2E_FACT_CARD_VERSION),
  status: z.literal("confirmed"),
  mode: z.literal("accompany_chat"),
  opening: z.string().trim().min(1).max(8_000),
  evaluatorGoal: z.string().trim().min(1).max(2_000),
  knownFactsAndFeelings: z.array(z.string().trim().min(1).max(1_000)).max(20),
  unknownOrUnclear: z.array(z.string().trim().min(1).max(1_000)).max(20),
  boundaries: z.array(z.string().trim().min(1).max(1_000)).max(20),
  successSigns: z.array(z.string().trim().min(1).max(1_000)).max(20),
  confirmedBy: z.literal("product_owner"),
  confirmedAt: z.string().datetime()
});

export type Board7aChatE2eFactCard = z.infer<typeof factCardSchema>;

export function validateBoard7aChatE2eFactCard(
  value: unknown
): Board7aChatE2eFactCard {
  return factCardSchema.parse(value);
}

export const board7aChatE2eMessageSchema = z.object({
  id: z.string().trim().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(12_000)
});

export type Board7aChatE2eMessage = z.infer<
  typeof board7aChatE2eMessageSchema
>;

export const board7aChatE2eSemanticSchema = z.object({
  action: z.enum(["acknowledge", "ask", "synthesize", "pause"]),
  focus: z.string().trim().min(1).max(500),
  evidenceRefs: z.array(z.string().trim().min(1)).min(1).max(20),
  questionGoal: z.string().trim().min(1).max(500).nullable(),
  limitReason: z.string().trim().min(1).max(500).nullable()
});

export const board7aChatE2eVisibleSchema = z.object({
  understanding: z.string().trim().min(1).max(1_000).nullable(),
  response: z.string().trim().min(1).max(2_000)
});

export const board7aChatE2eOutputSchema = z.object({
  semantic: board7aChatE2eSemanticSchema,
  visible: board7aChatE2eVisibleSchema
});

export type Board7aChatE2eSemantic = z.infer<
  typeof board7aChatE2eSemanticSchema
>;
export type Board7aChatE2eVisible = z.infer<
  typeof board7aChatE2eVisibleSchema
>;
export type Board7aChatE2eOutput = z.infer<
  typeof board7aChatE2eOutputSchema
>;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function parseBoard7aChatE2eOutput(
  content: string
): Board7aChatE2eOutput {
  const trimmed = content.trim();
  const normalized = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "")
    : trimmed;
  const parsed = JSON.parse(normalized) as unknown;
  return board7aChatE2eOutputSchema.parse(parsed);
}

function questionMarkCount(text: string) {
  return [...text].filter(
    (character) => character === "?" || character === "？"
  ).length;
}

export function validateBoard7aChatE2eOutput(input: {
  messages: Board7aChatE2eMessage[];
  output: Board7aChatE2eOutput;
}) {
  const issues: string[] = [];
  const userMessageIds = new Set(
    input.messages
      .filter((message) => message.role === "user")
      .map((message) => message.id)
  );
  const refs = input.output.semantic.evidenceRefs;
  if (new Set(refs).size !== refs.length) {
    issues.push("DUPLICATE_EVIDENCE_REFS");
  }
  for (const ref of refs) {
    if (!userMessageIds.has(ref)) issues.push(`UNKNOWN_USER_EVIDENCE_REF:${ref}`);
  }

  const visibleText = [
    input.output.visible.understanding,
    input.output.visible.response
  ]
    .filter(Boolean)
    .join("\n");
  const questions = questionMarkCount(visibleText);
  const { action, questionGoal, limitReason } = input.output.semantic;

  if (action === "ask") {
    if (!questionGoal) issues.push("ASK_QUESTION_GOAL_REQUIRED");
    if (limitReason) issues.push("ASK_LIMIT_REASON_MUST_BE_NULL");
    if (!input.output.visible.understanding) {
      issues.push("ASK_UNDERSTANDING_REQUIRED");
    }
    if (questions !== 1) issues.push(`ASK_QUESTION_COUNT_INVALID:${questions}`);
  } else {
    if (questionGoal) issues.push("NON_ASK_QUESTION_GOAL_MUST_BE_NULL");
    if (input.output.visible.understanding) {
      issues.push("NON_ASK_UNDERSTANDING_MUST_BE_NULL");
    }
    if (questions !== 0) {
      issues.push(`NON_ASK_QUESTION_COUNT_INVALID:${questions}`);
    }
  }

  if (action === "pause") {
    if (!limitReason) issues.push("PAUSE_LIMIT_REASON_REQUIRED");
  } else if (limitReason) {
    issues.push("NON_PAUSE_LIMIT_REASON_MUST_BE_NULL");
  }

  return issues;
}

export function renderBoard7aChatE2eVisible(
  visible: Board7aChatE2eVisible
) {
  return [visible.understanding, visible.response].filter(Boolean).join("\n\n");
}

export function createBoard7aChatE2eUserPrompt(input: {
  messages: Board7aChatE2eMessage[];
  latestUserMessageId: string;
}) {
  return JSON.stringify(
    {
      task: "陪用户围绕当前真实目标形成一条有来源、可纠正的认识",
      mode: "accompany_chat",
      conversation: input.messages,
      latestUserMessageId: input.latestUserMessageId
    },
    null,
    2
  );
}

export const BOARD7A_CHAT_E2E_VALIDATION_RULES = [
  "evidence_refs_user_messages_only",
  "ask_exactly_one_question",
  "non_ask_zero_questions",
  "ask_requires_question_goal_and_understanding",
  "pause_requires_limit_reason",
  "action_specific_fields_are_exclusive",
  "one_user_submission_one_generation_request",
  "technical_retry_requires_manual_action",
  "quality_retry_disabled",
  "approval_unlocks_exactly_one_fingerprinted_trajectory",
  "completed_trajectory_is_terminal"
] as const;

export function createBoard7aChatE2eCandidateScope() {
  return {
    evaluationId: BOARD7A_CHAT_E2E_EVALUATION_ID,
    candidateVersion: BOARD7A_CHAT_E2E_CANDIDATE_VERSION,
    runtimeConfig: BOARD7A_CHAT_E2E_RUNTIME_CONFIG,
    promptVersions: BOARD7A_CHAT_E2E_PROMPT_VERSIONS,
    basePrompt: BOARD7A_CHAT_E2E_BASE_PROMPT,
    interviewSkill: BOARD7A_CHAT_E2E_INTERVIEW_SKILL,
    outputContract: BOARD7A_CHAT_E2E_OUTPUT_CONTRACT,
    validationRules: BOARD7A_CHAT_E2E_VALIDATION_RULES,
    interaction: {
      mode: "accompany_chat",
      branches: 1,
      semanticReveal: "after_each_turn",
      contentTurnLimit: null,
      terminalResults: [
        "value_success",
        "qualified_pause",
        "user_control_exit",
        "quality_failure"
      ],
      journalIncluded: false
    },
    workbench: {
      binding: "127.0.0.1",
      randomAccessToken: true,
      approvalBinding: "candidate_and_confirmed_fact_card",
      runIdentity: "deterministic_from_run_fingerprint",
      approvalTrajectoryLimit: 1
    },
    storage: {
      raw: "gitignored_local_runtime",
      formal: "product_owner_confirmed_redacted_copy"
    }
  } as const;
}

export function createBoard7aChatE2eCandidateFingerprint() {
  return sha256(JSON.stringify(createBoard7aChatE2eCandidateScope()));
}

export function createBoard7aChatE2eRunScope(
  factCard: Board7aChatE2eFactCard
) {
  return {
    candidateFingerprint: createBoard7aChatE2eCandidateFingerprint(),
    factCard,
    approvalScope: BOARD7A_CHAT_E2E_APPROVAL_SCOPE
  } as const;
}

export function createBoard7aChatE2eRunFingerprint(
  factCard: Board7aChatE2eFactCard
) {
  return sha256(JSON.stringify(createBoard7aChatE2eRunScope(factCard)));
}

const approvalSchema = z.object({
  approvalType: z.literal(BOARD7A_CHAT_E2E_EVALUATION_ID),
  approvalVersion: z.literal(BOARD7A_CHAT_E2E_APPROVAL_VERSION),
  decision: z.literal("approved"),
  approvedBy: z.literal("product_owner"),
  approvedAt: z.string().datetime(),
  confirmationText: z.string().trim().min(2).max(500),
  candidateFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  runFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  factCardVersion: z.literal(BOARD7A_CHAT_E2E_FACT_CARD_VERSION),
  approvalScope: z.literal(BOARD7A_CHAT_E2E_APPROVAL_SCOPE)
});

export type Board7aChatE2eApproval = z.infer<typeof approvalSchema>;

export function validateBoard7aChatE2eApproval(input: {
  value: unknown;
  factCard: Board7aChatE2eFactCard;
}): Board7aChatE2eApproval {
  const approval = approvalSchema.parse(input.value);
  if (
    approval.candidateFingerprint !==
    createBoard7aChatE2eCandidateFingerprint()
  ) {
    throw new Error("BOARD7A_CHAT_E2E_CANDIDATE_FINGERPRINT_MISMATCH");
  }
  if (
    approval.runFingerprint !==
    createBoard7aChatE2eRunFingerprint(input.factCard)
  ) {
    throw new Error("BOARD7A_CHAT_E2E_RUN_FINGERPRINT_MISMATCH");
  }
  return approval;
}

export type Board7aChatE2eResultClass =
  | "value_success"
  | "qualified_pause"
  | "user_control_exit"
  | "quality_failure";

export const board7aChatE2eEndSchema = z.object({
  resultClass: z.enum([
    "value_success",
    "qualified_pause",
    "user_control_exit",
    "quality_failure"
  ]),
  reason: z.string().trim().min(1).max(4_000),
  singleCaseBlocker: z.boolean(),
  blockerReason: z.string().trim().max(2_000).nullable()
}).superRefine((value, context) => {
  if (value.singleCaseBlocker && !value.blockerReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["blockerReason"],
      message: "单例阻断需要填写理由"
    });
  }
  if (!value.singleCaseBlocker && value.blockerReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["blockerReason"],
      message: "未触发单例阻断时 blockerReason 应为空"
    });
  }
});

export type Board7aChatE2eEndDecision = z.infer<
  typeof board7aChatE2eEndSchema
>;
