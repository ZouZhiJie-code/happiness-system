import { createHash } from "node:crypto";

import { z } from "zod";

import type { AICompletionParams } from "@/server/services/ai/ai-provider";
import {
  GI088_ARK_FLASH_RUNTIME_POLICY,
  GI088_DEEPSEEK_PRO_RUNTIME_POLICY,
  GI088_TIMEOUT_POLICY,
  getGi088CandidateAssets
} from "@/server/services/evaluation/gi088/candidate";
import { createGi088StageTransitionUserPrompt } from "@/server/services/evaluation/gi088/stage-transition";
import {
  createGi088V8r3OfflineTurnInput
} from "../gi088-v8r3-skill-evaluation/offline-executor";
import {
  createGi088V8r3CaseFingerprint
} from "../gi088-v8r3-skill-evaluation/runner";
import type {
  Gi088V8r3EvaluationCase
} from "../gi088-v8r3-skill-evaluation/contracts";

export const GI088_RUNTIME_CONTRACT_DIAGNOSTIC_VERSION =
  "2026-08-12.gi088-runtime-contract-root-cause-diagnostic-v1" as const;
export const GI088_RUNTIME_CONTRACT_DIAGNOSTIC_REPORT_VERSION =
  "2026-08-12.gi088-runtime-contract-root-cause-report-v1" as const;
export const GI088_RUNTIME_CONTRACT_DIAGNOSTIC_SEED =
  "2026-08-12.gi088-runtime-contract-root-cause-fixed-seed-v1" as const;
export const GI088_RUNTIME_CONTRACT_DIAGNOSTIC_CONCURRENCY = 2 as const;
export const GI088_RUNTIME_CONTRACT_DIAGNOSTIC_GROUP_CALLS = 24 as const;
export const GI088_RUNTIME_CONTRACT_DIAGNOSTIC_INITIAL_CALLS = 96 as const;
export const GI088_RUNTIME_CONTRACT_DIAGNOSTIC_TOTAL_CALLS_MAXIMUM = 120 as const;
export const GI088_RUNTIME_CONTRACT_DIAGNOSTIC_SHORTLIST_MINIMUM = 20 as const;
export const GI088_RUNTIME_CONTRACT_FINAL_CASE_IDS = [
  "GI088-V8R3-D01",
  "GI088-V8R3-D05",
  "GI088-V8R3-D08",
  "GI088-V8R3-D10",
  "GI088-V8R3-D12",
  "GI088-V8R3-D15",
  "GI088-V8R3-D20",
  "GI088-V8R3-D23"
] as const;

export const GI088_RUNTIME_CONTRACT_GROUP_ORDER = [
  "A",
  "B",
  "C",
  "D",
  "E"
] as const;
export type Gi088RuntimeContractGroup =
  (typeof GI088_RUNTIME_CONTRACT_GROUP_ORDER)[number];

export type Gi088RuntimeContractPrimaryGroup = Exclude<
  Gi088RuntimeContractGroup,
  "E"
>;

export type Gi088RuntimeContractIdentity = {
  provider: "volcengine_ark" | "deepseek_official";
  transport: "openai_compatible_rest";
  baseUrlHost: "ark.cn-beijing.volces.com" | "api.deepseek.com";
  endpoint: "/chat/completions";
  model:
    | "deepseek-v4-flash-ga-260731"
    | "deepseek-v4-flash"
    | "deepseek-v4-pro";
  thinking: "enabled" | "disabled";
  reasoningEffort: "high" | null;
  responseFormat: "json_object";
  outputContractVersion:
    | "2026-08-10.gi088-semantic-delta-contract-v2.4"
    | "2026-08-12.gi088-simplified-diagnostic-output-v1";
  payloadContractVersion: string;
};

export const GI088_SIMPLIFIED_DIAGNOSTIC_OUTPUT_CONTRACT = `只输出一个合法 JSON 对象，字段必须完整且只能使用下面五个字段：
{
  "action": "acknowledge | ask | synthesize | pause",
  "evidenceRefs": ["当前记录中的用户消息 ID"],
  "answerTarget": "ask 时的一项回答目标，否则为 null",
  "understanding": "有来源的当前理解，可为 null",
  "response": "用户可见回应"
}

硬约束：
- evidenceRefs 只引用当前记录中的用户消息 ID。
- ask 只包含一个回答目标；所有问句都服务这个目标。
- acknowledge、synthesize、pause 的 answerTarget 为 null，response 保持零问题。
- pause 只在用户明确要求停止当前访谈时使用。` as const;

export const GI088_SIMPLIFIED_DIAGNOSTIC_SYSTEM_PROMPT = `你是 Daily Light 的访谈助手。你的任务是帮助用户逐步弄清此刻真正想理解的问题。

核心原则：
1. 固定当前共同任务。只有用户纠正、明确换重点或主动打开新任务时才切换。
2. 提问前检查：完整对话尚未回答；不同答案会改变认识；问题继续服务共同任务；用户能低负担回答；收益高于重复、漂移和无证据推断。
3. 问题价值不足时选择 synthesize 或 acknowledge，访谈保持开放。只有明确停止当前访谈才选择 pause。
4. 先吸收最新表达，再决定是否提问。用户明确继续只提高推进优先级，仍需通过问题价值检查。
5. 只使用当前记录中的用户来源。第三方原因缺少证据时，给出一至两个可修正假设，并询问可观察的区分信息。
6. 用户纠正后立即退出被否定的理解。可见回应使用自然、生活化语言，不展示内部分析过程。

三个微案例：
- 用户已经回答“最介意被否定感受”，再次确认“已经很确定”：整理当前认识，停止换句话重复追问。
- 用户明确当前任务是“带团队时如何分配工作”，顺口提到梦见考试：继续服务带团队的担心，梦境不接管共同任务。
- 用户问沉默的伴侣在想什么，手里只有沉默这一事实：保持不确定，可提出“生气”或“尚未想好”这类可修正假设，再问能区分它们的可观察信息。

${GI088_SIMPLIFIED_DIAGNOSTIC_OUTPUT_CONTRACT}` as const;

const nonEmpty = z.string().trim().min(1);
export const gi088SimplifiedDiagnosticOutputSchema = z
  .object({
    action: z.enum(["acknowledge", "ask", "synthesize", "pause"]),
    evidenceRefs: z.array(nonEmpty.max(120)).min(1).max(30),
    answerTarget: nonEmpty.max(1_000).nullable(),
    understanding: nonEmpty.max(1_000).nullable(),
    response: nonEmpty.max(2_000)
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "ask" && value.answerTarget === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answerTarget"],
        message: "ask requires one answer target"
      });
    }
    if (value.action !== "ask" && value.answerTarget !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answerTarget"],
        message: "non-ask response must not expose an answer target"
      });
    }
  });

export type Gi088SimplifiedDiagnosticOutput = z.infer<
  typeof gi088SimplifiedDiagnosticOutputSchema
>;

export type Gi088RuntimeContractVisibleProjection = {
  action: "acknowledge" | "ask" | "synthesize" | "pause";
  evidenceRefs: string[];
  answerTarget: string | null;
  understanding: string | null;
  response: string;
};

export type Gi088RuntimeContractScheduleItem = {
  scheduleIndex: number;
  caseId: string;
  caseFingerprint: string;
  group: Gi088RuntimeContractPrimaryGroup;
  checkpointIndex: 0;
};

export type Gi088RuntimeContractGroupDefinition = {
  group: Gi088RuntimeContractGroup;
  label: string;
  changedFactor: string;
  identity: Gi088RuntimeContractIdentity;
  promptSha256: string;
  contractSha256: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createGi088RuntimeContractGroupDefinition(
  group: Gi088RuntimeContractGroup
): Gi088RuntimeContractGroupDefinition {
  const fullPrompt = getGi088CandidateAssets().systemPrompt;
  const fullContract = getGi088CandidateAssets().outputContract;
  const payloadContractVersion =
    GI088_ARK_FLASH_RUNTIME_POLICY.payloadContractVersion;
  const definitions: Record<
    Gi088RuntimeContractGroup,
    Omit<Gi088RuntimeContractGroupDefinition, "promptSha256" | "contractSha256">
  > = {
    A: {
      group: "A",
      label: "Ark Flash · Thinking high · 完整合同",
      changedFactor: "baseline",
      identity: {
        provider: "volcengine_ark",
        transport: "openai_compatible_rest",
        baseUrlHost: "ark.cn-beijing.volces.com",
        endpoint: "/chat/completions",
        model: "deepseek-v4-flash-ga-260731",
        thinking: "enabled",
        reasoningEffort: "high",
        responseFormat: "json_object",
        outputContractVersion:
          "2026-08-10.gi088-semantic-delta-contract-v2.4",
        payloadContractVersion
      }
    },
    B: {
      group: "B",
      label: "Ark Flash · Thinking high · 精简合同",
      changedFactor: "output_responsibility",
      identity: {
        provider: "volcengine_ark",
        transport: "openai_compatible_rest",
        baseUrlHost: "ark.cn-beijing.volces.com",
        endpoint: "/chat/completions",
        model: "deepseek-v4-flash-ga-260731",
        thinking: "enabled",
        reasoningEffort: "high",
        responseFormat: "json_object",
        outputContractVersion:
          "2026-08-12.gi088-simplified-diagnostic-output-v1",
        payloadContractVersion
      }
    },
    C: {
      group: "C",
      label: "Ark Flash · Thinking disabled · 完整合同",
      changedFactor: "thinking",
      identity: {
        provider: "volcengine_ark",
        transport: "openai_compatible_rest",
        baseUrlHost: "ark.cn-beijing.volces.com",
        endpoint: "/chat/completions",
        model: "deepseek-v4-flash-ga-260731",
        thinking: "disabled",
        reasoningEffort: null,
        responseFormat: "json_object",
        outputContractVersion:
          "2026-08-10.gi088-semantic-delta-contract-v2.4",
        payloadContractVersion
      }
    },
    D: {
      group: "D",
      label: "DeepSeek 官方 Flash · Thinking high · 完整合同",
      changedFactor: "provider",
      identity: {
        provider: "deepseek_official",
        transport: "openai_compatible_rest",
        baseUrlHost: "api.deepseek.com",
        endpoint: "/chat/completions",
        model: "deepseek-v4-flash",
        thinking: "enabled",
        reasoningEffort: "high",
        responseFormat: "json_object",
        outputContractVersion:
          "2026-08-10.gi088-semantic-delta-contract-v2.4",
        payloadContractVersion:
          "2026-08-12.gi088-deepseek-official-json-v1"
      }
    },
    E: {
      group: "E",
      label: "DeepSeek 官方 Pro · Thinking high · 完整合同",
      changedFactor: "model",
      identity: {
        provider: "deepseek_official",
        transport: "openai_compatible_rest",
        baseUrlHost: "api.deepseek.com",
        endpoint: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.endpoint,
        model: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.model,
        thinking: "enabled",
        reasoningEffort: "high",
        responseFormat: "json_object",
        outputContractVersion:
          "2026-08-10.gi088-semantic-delta-contract-v2.4",
        payloadContractVersion:
          "2026-08-12.gi088-deepseek-official-json-v1"
      }
    }
  };
  const definition = definitions[group];
  const simplified = group === "B";
  return {
    ...definition,
    promptSha256: sha256(
      simplified ? GI088_SIMPLIFIED_DIAGNOSTIC_SYSTEM_PROMPT : fullPrompt
    ),
    contractSha256: sha256(
      simplified ? GI088_SIMPLIFIED_DIAGNOSTIC_OUTPUT_CONTRACT : fullContract
    )
  };
}

function controlActionForCase(evaluationCase: Gi088V8r3EvaluationCase) {
  const checkpoint = evaluationCase.checkpoints[0]!;
  return checkpoint.allowedActions.length === 1 &&
    checkpoint.allowedActions[0] === "pause"
    ? "stop_follow_up" as const
    : "none" as const;
}

export function createGi088RuntimeContractCompletionParams(input: {
  group: Gi088RuntimeContractGroup;
  evaluationCase: Gi088V8r3EvaluationCase;
}): AICompletionParams {
  if (
    input.evaluationCase.partition !== "development" ||
    input.evaluationCase.kind !== "single_turn" ||
    input.evaluationCase.checkpoints.length !== 1
  ) {
    throw new Error("GI088_RUNTIME_CONTRACT_DEVELOPMENT_CASE_INVALID");
  }
  const definition = createGi088RuntimeContractGroupDefinition(input.group);
  const turnInput = createGi088V8r3OfflineTurnInput(input.evaluationCase, 0);
  const systemPrompt = input.group === "B"
    ? GI088_SIMPLIFIED_DIAGNOSTIC_SYSTEM_PROMPT
    : getGi088CandidateAssets().systemPrompt;
  return {
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: `本轮程序控制决定：${JSON.stringify({
          finalAction: controlActionForCase(input.evaluationCase),
          decisionVersion:
            "2026-08-12.gi088-runtime-contract-diagnostic-control-v1"
        })}`
      },
      {
        role: "user",
        content: createGi088StageTransitionUserPrompt(turnInput)
      }
    ],
    useProviderDefaultMaxTokens: true,
    timeoutMs: GI088_TIMEOUT_POLICY.hardTimeoutMs,
    headersTimeoutMs: 60_000,
    bodyIdleTimeoutMs: 60_000,
    hardTimeoutMs: 60_000,
    responseFormat: "json_object",
    thinking: definition.identity.thinking,
    ...(definition.identity.reasoningEffort
      ? { reasoningEffort: definition.identity.reasoningEffort }
      : {})
  };
}

export function createGi088RuntimeContractSchedule(
  cases: readonly Gi088V8r3EvaluationCase[]
) {
  if (
    cases.length !== GI088_RUNTIME_CONTRACT_DIAGNOSTIC_GROUP_CALLS ||
    cases.some(
      (item) =>
        item.partition !== "development" ||
        item.kind !== "single_turn" ||
        item.checkpoints.length !== 1
    )
  ) {
    throw new Error("GI088_RUNTIME_CONTRACT_CASE_SET_INVALID");
  }
  const ids = new Set(cases.map((item) => item.id));
  if (ids.size !== cases.length) {
    throw new Error("GI088_RUNTIME_CONTRACT_CASE_SET_DUPLICATED");
  }
  const shuffled = [...cases].sort((left, right) =>
    sha256(`${GI088_RUNTIME_CONTRACT_DIAGNOSTIC_SEED}:${left.id}`)
      .localeCompare(
        sha256(`${GI088_RUNTIME_CONTRACT_DIAGNOSTIC_SEED}:${right.id}`)
      )
  );
  const groups: Gi088RuntimeContractPrimaryGroup[] = ["A", "B", "C", "D"];
  const schedule = shuffled.flatMap((evaluationCase, caseIndex) => {
    const offset = caseIndex % groups.length;
    const rotated = [
      ...groups.slice(offset),
      ...groups.slice(0, offset)
    ];
    return rotated.map((group) => ({
      scheduleIndex: 0,
      caseId: evaluationCase.id,
      caseFingerprint: createGi088V8r3CaseFingerprint(evaluationCase),
      group,
      checkpointIndex: 0 as const
    }));
  }).map((item, index) => ({ ...item, scheduleIndex: index + 1 }));
  if (schedule.length !== GI088_RUNTIME_CONTRACT_DIAGNOSTIC_INITIAL_CALLS) {
    throw new Error("GI088_RUNTIME_CONTRACT_SCHEDULE_SIZE_INVALID");
  }
  return {
    seed: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_SEED,
    shuffledCaseIds: shuffled.map((item) => item.id),
    schedule,
    scheduleFingerprint: sha256(JSON.stringify(schedule))
  };
}

export function validateGi088SharedProductRules(input: {
  evaluationCase: Gi088V8r3EvaluationCase;
  projection: Gi088RuntimeContractVisibleProjection;
}) {
  const checkpoint = input.evaluationCase.checkpoints[0]!;
  const userIds = new Set(
    input.evaluationCase.messages
      .filter((message) => message.role === "user")
      .map((message) => message.id)
  );
  const issues: string[] = [];
  if (!checkpoint.allowedActions.includes(input.projection.action)) {
    issues.push("ACTION_NOT_ALLOWED");
  }
  if (
    input.projection.evidenceRefs.length === 0 ||
    input.projection.evidenceRefs.some((reference) => !userIds.has(reference))
  ) {
    issues.push("EVIDENCE_SOURCE_INVALID");
  }
  if (
    checkpoint.requiredEvidenceMessageIds.some(
      (reference) => !input.projection.evidenceRefs.includes(reference)
    )
  ) {
    issues.push("REQUIRED_EVIDENCE_MISSING");
  }
  if (
    input.projection.action === "ask" &&
    !input.projection.answerTarget?.trim()
  ) {
    issues.push("ASK_ANSWER_TARGET_MISSING");
  }
  if (
    input.projection.action !== "ask" &&
    input.projection.answerTarget !== null
  ) {
    issues.push("NON_ASK_ANSWER_TARGET_PRESENT");
  }
  if (
    input.projection.action !== "ask" &&
    /[?？]/u.test(input.projection.response)
  ) {
    issues.push("NON_ASK_QUESTION_PRESENT");
  }
  if (
    input.projection.action === "pause" &&
    !checkpoint.allowedActions.includes("pause")
  ) {
    issues.push("UNAUTHORIZED_PAUSE");
  }
  if (!input.projection.response.trim()) {
    issues.push("VISIBLE_RESPONSE_EMPTY");
  }
  return [...new Set(issues)];
}

export function createGi088RuntimeContractDiagnosticFingerprint(input: {
  cases: readonly Gi088V8r3EvaluationCase[];
  globalFingerprintBundle: Record<string, string>;
}) {
  const schedule = createGi088RuntimeContractSchedule(input.cases);
  return sha256(JSON.stringify({
    diagnosticVersion: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_VERSION,
    globalFingerprintBundle: input.globalFingerprintBundle,
    caseCommitments: [...input.cases]
      .map((item) => ({
        caseId: item.id,
        fingerprint: createGi088V8r3CaseFingerprint(item)
      }))
      .sort((left, right) => left.caseId.localeCompare(right.caseId)),
    groups: GI088_RUNTIME_CONTRACT_GROUP_ORDER.map((group) =>
      createGi088RuntimeContractGroupDefinition(group)
    ),
    scheduleFingerprint: schedule.scheduleFingerprint,
    concurrency: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_CONCURRENCY,
    budgets: {
      initial: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_INITIAL_CALLS,
      totalMaximum: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_TOTAL_CALLS_MAXIMUM
    },
    finalReviewCaseIds: GI088_RUNTIME_CONTRACT_FINAL_CASE_IDS
  }));
}

