import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import {
  BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION,
  BOARD7B_PROMPT_SKILL_V0_1_LOCAL_RUNTIME_DIRECTORY,
  BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG,
  applyBoard7bPromptSkillV01SemanticResult,
  createBoard7bPromptSkillV01CandidateFingerprint,
  createBoard7bPromptSkillV01InitialSemanticState,
  createBoard7bPromptSkillV01UserPrompt,
  loadBoard7bPromptSkillV01Assets,
  parseBoard7bPromptSkillV01Output,
  validateBoard7bPromptSkillV01Output,
  type Board7bPromptSkillV01Output,
  type Board7bPromptSkillV01SemanticState,
  type Board7bPromptSkillV01TurnInput
} from "../evals/event-centered-generative/board7b-prompt-skill-v0-1/board7b-prompt-skill-v0-1";
import type {
  AICompletionResult,
  AIProvider
} from "../src/server/services/ai/ai-provider";
import { getAIProviderFailureCode } from "../src/server/services/ai/ai-provider";
import { getEventCenteredAIProvider } from "../src/server/services/ai/event-centered-provider";

const PACKAGE_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.1";
const AUTHORIZATION_FILE =
  "board7b-prompt-skill-v0.1-regression-authorization.json";
const REGRESSION_PLAN_FILE = "board7b-prompt-skill-v0.1-regression-plan.json";
const KEYCHAIN_ACCOUNT = "board7a";
const KEYCHAIN_SERVICE = "com.dailylight.local-eval.deepseek";
const execFileAsync = promisify(execFile);

const authorizationSchema = z
  .object({
    authorizationVersion: z.literal(
      "2026-08-07.board7b-prompt-skill-authorization-v0.1"
    ),
    decision: z.literal("approved"),
    candidateVersion: z.literal(
      BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION
    ),
    candidateFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    authorizationScope: z.literal("eight_case_hidden_regression"),
    authorizedModelCallBudget: z.literal(8),
    authorizedEnvironment: z.literal("isolated_local_evaluation"),
    approvedBy: z.literal("product_owner_conversation"),
    approvedAt: z.string().datetime(),
    productionChangeAuthorized: z.literal(false)
  })
  .passthrough();

const regressionPlanSchema = z
  .object({
    planVersion: z.string().trim().min(1),
    candidateVersion: z.literal(
      BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION
    ),
    candidateFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    plannedCalls: z.literal(8),
    authorizedCalls: z.literal(0)
  })
  .passthrough();

export type RegressionCase = {
  callNumber: number;
  caseId: string;
  repetition: number;
  turnInput: Board7bPromptSkillV01TurnInput;
};

export type RegressionCallRecord = {
  callNumber: number;
  caseId: string;
  repetition: number;
  startedAt: string;
  completedAt: string;
  status: "valid" | "protected_failure" | "technical_failure";
  requestHash: string;
  responseHash: string | null;
  provider: string | null;
  latencyMs: number | null;
  tokenUsage: AICompletionResult["tokenUsage"] | null;
  turnInput: Board7bPromptSkillV01TurnInput;
  rawOutput: string | null;
  output: Board7bPromptSkillV01Output | null;
  validationIssues: string[];
  semanticStateAfter: Board7bPromptSkillV01SemanticState | null;
  errorCode: string | null;
};

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function writeJsonAtomic(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

function linkedState(input: {
  stage: "engage_focus" | "explore_clarify" | "deepen_integrate";
  focusSummary: string;
  focusEvidenceRefs: string[];
  understandingSummary?: string;
  openPartSummary?: string;
  burdenSummary?: string;
  stage1Used?: number;
  stage2Used?: number;
}): Board7bPromptSkillV01SemanticState {
  const focusStateId = `state-focus-${sha256(input.focusSummary).slice(0, 12)}`;
  return {
    stage: input.stage,
    focus: {
      stateId: focusStateId,
      summary: input.focusSummary,
      evidenceRefs: input.focusEvidenceRefs
    },
    understandings: input.understandingSummary
      ? [
          {
            stateId: `state-understanding-${sha256(input.understandingSummary).slice(0, 12)}`,
            summary: input.understandingSummary,
            evidenceRefs: input.focusEvidenceRefs
          }
        ]
      : [],
    openParts: input.openPartSummary
      ? [
          {
            stateId: `state-open-${sha256(input.openPartSummary).slice(0, 12)}`,
            summary: input.openPartSummary,
            evidenceRefs: input.focusEvidenceRefs
          }
        ]
      : [],
    invalidatedItems: [],
    importantBranches: [],
    burdenSignal: input.burdenSummary
      ? {
          stateId: `state-burden-${sha256(input.burdenSummary).slice(0, 12)}`,
          summary: input.burdenSummary,
          evidenceRefs: input.focusEvidenceRefs
        }
      : null,
    answerOpportunities: {
      currentFocusStateId: focusStateId,
      ledgers: [
        {
          focusStateId,
          stage1Used: input.stage1Used ?? 0,
          stage2Used: input.stage2Used ?? 0,
          awaiting: null
        }
      ]
    }
  };
}

const autumnU1 =
  "最近在准备秋招，我现在是剩下窗口期也就一个月左右，要决定我的一个毕业的工作了，但我现在还是很纠结的。因为我在考虑到底去什么样的公司？去什么样的行业？做什么样的业务？由于我的实践尝试实在是太少了，所以只能继续去类似开盲盒的形式。做一些尝试和判断。而且我现在还在去准备一些作品集，以保证我能够通过简历筛选。所以我无论是从远来看。我要去怎样的公司？行业业务还是从进来看我能不能找到工作，都对我来说还是比较焦急的。";
const autumnHistoricalA1 =
  "你提到秋招窗口期只剩一个月，既要决定公司、行业和业务方向，又要准备作品集通过筛选，确实两头都压着。\n\n你现在最纠结的是先定方向，还是先保证能拿到 offer？";
const autumnU2 = "我现在主要还是先拿 offer 吧，所以我在准备一些作品集。";

export function createRegressionCases(): RegressionCase[] {
  const opening = {
    id: "A0",
    role: "assistant" as const,
    content: "此刻你想聊点什么？"
  };
  const cases: RegressionCase[] = [];
  for (const repetition of [1, 2]) {
    cases.push({
      callNumber: cases.length + 1,
      caseId: "autumn-open",
      repetition,
      turnInput: {
        mode: "accompany_chat",
        conversation: [
          opening,
          { id: "U1", role: "user", content: autumnU1 }
        ],
        latestUserMessageId: "U1",
        semanticState: createBoard7bPromptSkillV01InitialSemanticState()
      }
    });
  }
  for (const repetition of [1, 2]) {
    cases.push({
      callNumber: cases.length + 1,
      caseId: "autumn-prioritize-offer",
      repetition,
      turnInput: {
        mode: "accompany_chat",
        conversation: [
          opening,
          { id: "U1", role: "user", content: autumnU1 },
          { id: "A1", role: "assistant", content: autumnHistoricalA1 },
          { id: "U2", role: "user", content: autumnU2 }
        ],
        latestUserMessageId: "U2",
        semanticState: linkedState({
          stage: "engage_focus",
          focusSummary:
            "秋招窗口内同时推进拿到工作和判断公司、行业与业务方向",
          focusEvidenceRefs: ["U1"],
          understandingSummary:
            "近期作品集过筛压力与长期方向不确定同时存在并互相影响",
          openPartSummary:
            "用户给出当前优先级后，长期方向怎样影响当前作品集准备",
          burdenSummary: "秋招窗口约剩一个月，用户感到焦急",
          stage1Used: 1
        })
      }
    });
  }

  cases.push({
    callNumber: cases.length + 1,
    caseId: "boundary-defer-long-term",
    repetition: 1,
    turnInput: {
      mode: "accompany_chat",
      conversation: [
        opening,
        {
          id: "U1",
          role: "user",
          content: "我眼下先想把面试准备做好，但长期方向也有点担心。"
        },
        {
          id: "A1",
          role: "assistant",
          content:
            "眼下的面试准备和长期方向会互相影响。长期顾虑具体在哪一步影响了你现在的准备？"
        },
        {
          id: "U2",
          role: "user",
          content: "长期方向我暂时不想讨论，先看眼下准备。"
        }
      ],
      latestUserMessageId: "U2",
      semanticState: linkedState({
        stage: "explore_clarify",
        focusSummary: "眼下面试准备与长期方向的相互影响",
        focusEvidenceRefs: ["U1"],
        openPartSummary: "长期方向怎样影响眼下准备",
        stage2Used: 1
      })
    }
  });

  cases.push({
    callNumber: cases.length + 1,
    caseId: "coexisting-content-transfer",
    repetition: 1,
    turnInput: {
      mode: "accompany_chat",
      conversation: [
        opening,
        {
          id: "U1",
          role: "user",
          content:
            "我一方面想尽快搬出去，另一方面又担心短期租约会限制明年的工作地点选择。"
        }
      ],
      latestUserMessageId: "U1",
      semanticState: createBoard7bPromptSkillV01InitialSemanticState()
    }
  });

  cases.push({
    callNumber: cases.length + 1,
    caseId: "user-correction",
    repetition: 1,
    turnInput: {
      mode: "accompany_chat",
      conversation: [
        opening,
        {
          id: "U1",
          role: "user",
          content: "最近工作很累，我一直想离开。"
        },
        {
          id: "A1",
          role: "assistant",
          content: "这份疲惫最近在工作里的哪个时刻最明显？"
        },
        {
          id: "U2",
          role: "user",
          content: "重点已经不是累不累，我更想看清离开后会不会后悔。"
        }
      ],
      latestUserMessageId: "U2",
      semanticState: linkedState({
        stage: "explore_clarify",
        focusSummary: "工作疲惫与离开当前工作的想法",
        focusEvidenceRefs: ["U1"],
        openPartSummary: "工作疲惫最明显的具体时刻",
        stage2Used: 1
      })
    }
  });

  cases.push({
    callNumber: cases.length + 1,
    caseId: "unclear-stop-again",
    repetition: 1,
    turnInput: {
      mode: "accompany_chat",
      conversation: [
        opening,
        { id: "U1", role: "user", content: "我说不清。" },
        {
          id: "A1",
          role: "assistant",
          content: "如果只想一个最近最明显的时刻呢？"
        },
        {
          id: "U2",
          role: "user",
          content: "还是说不清，我不想再想了。"
        }
      ],
      latestUserMessageId: "U2",
      semanticState: linkedState({
        stage: "explore_clarify",
        focusSummary: "用户当前想表达但仍说不清的内容",
        focusEvidenceRefs: ["U1"],
        openPartSummary: "最近最明显的具体时刻",
        burdenSummary: "用户第一次表示说不清",
        stage2Used: 1
      })
    }
  });
  return cases;
}

export async function resolveCandidateCredential() {
  const processKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (processKey) return { apiKey: processKey, source: "process_environment" };
  try {
    const { stdout } = await execFileAsync(
      "/usr/bin/security",
      [
        "find-generic-password",
        "-a",
        KEYCHAIN_ACCOUNT,
        "-s",
        KEYCHAIN_SERVICE,
        "-w"
      ],
      { encoding: "utf8" }
    );
    const apiKey = stdout.trim();
    if (apiKey) return { apiKey, source: "macos_keychain" };
  } catch {
    // 错误信息保持无凭据内容。
  }
  throw Object.assign(new Error("EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"), {
    code: "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"
  });
}

export async function validateCredential(apiKey: string) {
  const response = await fetch("https://api.deepseek.com/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) {
    throw Object.assign(
      new Error(`DEEPSEEK_CREDENTIAL_PREFLIGHT_HTTP_${response.status}`),
      { code: `DEEPSEEK_CREDENTIAL_PREFLIGHT_HTTP_${response.status}` }
    );
  }
  const body = (await response.json()) as { data?: Array<{ id?: string }> };
  if (
    !body.data?.some(
      (model) => model.id === BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.model
    )
  ) {
    throw Object.assign(new Error("DEEPSEEK_CANDIDATE_MODEL_UNAVAILABLE"), {
      code: "DEEPSEEK_CANDIDATE_MODEL_UNAVAILABLE"
    });
  }
}

export async function createProvider(apiKey: string) {
  const provider = await getEventCenteredAIProvider({
    env: {
      NODE_ENV: "development",
      AI_PROVIDER: "openai",
      DEEPSEEK_API_KEY: apiKey,
      DEEPSEEK_MODEL: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.model,
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      EVENT_CENTERED_GENERATIVE_MODEL:
        BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.model
    }
  });
  if (!provider) throw new Error("BOARD7B_PROMPT_SKILL_V0_1_PROVIDER_UNAVAILABLE");
  return provider;
}

function errorCode(error: unknown) {
  if (error instanceof Error && error.name === "ZodError") {
    return "INVALID_JSON_SCHEMA";
  }
  if (error instanceof SyntaxError) return "INVALID_JSON";
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return getAIProviderFailureCode(error);
}

export async function executeCase(input: {
  regressionCase: RegressionCase;
  provider: AIProvider;
  systemPrompt: string;
}): Promise<RegressionCallRecord> {
  const startedAt = new Date().toISOString();
  const userPrompt = createBoard7bPromptSkillV01UserPrompt(
    input.regressionCase.turnInput
  );
  const requestHash = sha256(
    JSON.stringify({
      systemPrompt: input.systemPrompt,
      userPrompt,
      runtimeConfig: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG
    })
  );
  let completion: AICompletionResult | null = null;
  try {
    completion = await input.provider.complete({
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.temperature,
      maxTokens: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.maxTokens,
      timeoutMs: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.timeoutMs,
      responseFormat: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.responseFormat,
      thinking: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.thinking
    });
    const output = parseBoard7bPromptSkillV01Output(completion.content);
    const validationIssues = validateBoard7bPromptSkillV01Output({
      input: input.regressionCase.turnInput,
      output
    });
    const semanticStateAfter = validationIssues.length
      ? null
      : applyBoard7bPromptSkillV01SemanticResult({
          input: input.regressionCase.turnInput,
          output
        });
    return {
      callNumber: input.regressionCase.callNumber,
      caseId: input.regressionCase.caseId,
      repetition: input.regressionCase.repetition,
      startedAt,
      completedAt: new Date().toISOString(),
      status: validationIssues.length ? "protected_failure" : "valid",
      requestHash,
      responseHash: sha256(completion.content),
      provider: completion.provider,
      latencyMs: completion.latencyMs,
      tokenUsage: completion.tokenUsage ?? null,
      turnInput: input.regressionCase.turnInput,
      rawOutput: completion.content,
      output,
      validationIssues,
      semanticStateAfter,
      errorCode: validationIssues.length ? "PROGRAM_PROTECTION_REJECTED" : null
    };
  } catch (error) {
    return {
      callNumber: input.regressionCase.callNumber,
      caseId: input.regressionCase.caseId,
      repetition: input.regressionCase.repetition,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "technical_failure",
      requestHash,
      responseHash: completion?.content ? sha256(completion.content) : null,
      provider: completion?.provider ?? input.provider.name,
      latencyMs: completion?.latencyMs ?? null,
      tokenUsage: completion?.tokenUsage ?? null,
      turnInput: input.regressionCase.turnInput,
      rawOutput: completion?.content ?? null,
      output: null,
      validationIssues: [],
      semanticStateAfter: null,
      errorCode: errorCode(error)
    };
  }
}

async function main() {
  const workspaceRoot = process.cwd();
  const packagePath = resolve(workspaceRoot, PACKAGE_DIRECTORY);
  const [assets, authorizationSource, planSource] = await Promise.all([
    loadBoard7bPromptSkillV01Assets(workspaceRoot),
    readFile(resolve(packagePath, AUTHORIZATION_FILE), "utf8"),
    readFile(resolve(packagePath, REGRESSION_PLAN_FILE), "utf8")
  ]);
  const candidateFingerprint =
    createBoard7bPromptSkillV01CandidateFingerprint(assets);
  const authorization = authorizationSchema.parse(
    JSON.parse(authorizationSource) as unknown
  );
  const plan = regressionPlanSchema.parse(JSON.parse(planSource) as unknown);
  if (
    authorization.candidateFingerprint !== candidateFingerprint ||
    plan.candidateFingerprint !== candidateFingerprint
  ) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_1_FINGERPRINT_MISMATCH");
  }
  const cases = createRegressionCases();
  if (
    cases.length !== authorization.authorizedModelCallBudget ||
    cases.length !== plan.plannedCalls
  ) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_1_CALL_BUDGET_MISMATCH");
  }
  const runFingerprint = sha256(
    JSON.stringify({
      candidateFingerprint,
      authorizationVersion: authorization.authorizationVersion,
      approvedAt: authorization.approvedAt,
      planVersion: plan.planVersion,
      callBudget: cases.length
    })
  );
  const outputPath = resolve(
    workspaceRoot,
    BOARD7B_PROMPT_SKILL_V0_1_LOCAL_RUNTIME_DIRECTORY,
    `regression-${runFingerprint}`,
    "raw-results.json"
  );
  const run = {
    evaluationId: "board7b_prompt_skill_v0_1_regression",
    candidateVersion: BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION,
    candidateFingerprint,
    runFingerprint,
    planVersion: plan.planVersion,
    authorization: {
      version: authorization.authorizationVersion,
      scope: authorization.authorizationScope,
      approvedBy: authorization.approvedBy,
      approvedAt: authorization.approvedAt,
      callBudget: authorization.authorizedModelCallBudget
    },
    runtimeConfig: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG,
    startedAt: new Date().toISOString(),
    completedAt: null as string | null,
    calls: [] as RegressionCallRecord[]
  };

  if (!process.argv.includes("--run")) {
    process.stdout.write(
      `${JSON.stringify(
        {
          candidateFingerprint,
          runFingerprint,
          authorization: "valid",
          plannedCalls: cases.length,
          modelCalls: 0
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const credential = await resolveCandidateCredential();
  await validateCredential(credential.apiKey);
  const provider = await createProvider(credential.apiKey);
  await writeJsonAtomic(outputPath, run);
  process.stdout.write(
    `GI-084 v0.1 回归开始：指纹 ${candidateFingerprint.slice(0, 12)}…，预算 8，凭据 ${credential.source}。\n`
  );
  for (const regressionCase of cases) {
    const record = await executeCase({
      regressionCase,
      provider,
      systemPrompt: assets.systemPrompt
    });
    run.calls.push(record);
    await writeJsonAtomic(outputPath, run);
    process.stdout.write(
      `调用 ${record.callNumber}/8｜${record.caseId}#${record.repetition}｜${record.status}\n`
    );
  }
  run.completedAt = new Date().toISOString();
  await writeJsonAtomic(outputPath, run);
  process.stdout.write(
    `${JSON.stringify(
      {
        runFingerprint,
        outputPath,
        attemptedCalls: run.calls.length,
        valid: run.calls.filter((call) => call.status === "valid").length,
        protectedFailures: run.calls.filter(
          (call) => call.status === "protected_failure"
        ).length,
        technicalFailures: run.calls.filter(
          (call) => call.status === "technical_failure"
        ).length
      },
      null,
      2
    )}\n`
  );
}

if (
  process.argv[1]?.endsWith("run-board7b-prompt-skill-v0-1-regression.ts")
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
