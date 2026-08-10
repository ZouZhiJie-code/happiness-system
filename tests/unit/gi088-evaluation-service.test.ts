import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { parseGi088SemanticDeltaOutput } from "../../src/server/services/evaluation/gi088/semantic-delta";

import {
  GI088_ASSET_SOURCE_SHA256,
  GI088_CONFIGS,
  GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION,
  GI088_EVALUATION_ID,
  GI088_EVALUATION_ID_V1,
  GI088_EVALUATION_ID_V2,
  GI088_EVALUATION_ID_V3,
  GI088_EVALUATION_ID_V4,
  GI088_EVALUATION_ID_V5,
  GI088_EVALUATION_ID_V6,
  GI088_EVALUATION_ID_V7,
  GI088_EVALUATION_ID_V7R1,
  GI088_EVALUATION_VERSION,
  GI088_EVALUATION_VERSION_V1,
  GI088_EVALUATION_VERSION_V2,
  GI088_EVALUATION_VERSION_V3,
  GI088_EVALUATION_VERSION_V4,
  GI088_EVALUATION_VERSION_V5,
  GI088_EVALUATION_VERSION_V6,
  GI088_EVALUATION_VERSION_V7,
  GI088_EVALUATION_VERSION_V7R1,
  GI088_GI087_CANDIDATE_FINGERPRINT,
  GI088_GOVERNED_EVALUATION_VERSIONS,
  GI088_SERVICE_VERSION,
  GI088_SERVICE_VERSION_V1,
  GI088_SERVICE_VERSION_V2,
  GI088_SERVICE_VERSION_V3,
  GI088_SERVICE_VERSION_V4,
  GI088_SERVICE_VERSION_V5,
  GI088_SERVICE_VERSION_V6,
  GI088_SERVICE_VERSION_V7,
  GI088_SERVICE_VERSION_V7R1,
  GI088_TASKS,
  GI088_TIMEOUT_POLICY,
  createGi088DatasetFingerprint,
  createGi088EffectiveCandidateFingerprint,
  createGi088ExecutionFingerprint,
  getGi088BaseCandidateAssets,
  getGi088CandidateAssets,
  verifyGi088CandidateSnapshot
} from "../../src/server/services/evaluation/gi088/candidate";
import {
  GI088_STAGE_TRANSITION_APPENDICES,
  GI088_STAGE_TRANSITION_RECOVERY_INSTRUCTION
} from "../../src/server/services/evaluation/gi088/stage-transition";
import {
  GI088_EVALUATION_ENABLE_VALUE,
  canOpenGi088Evaluation,
  isGi088EvaluatorUsername,
  parseGi088EvaluatorUsernames,
  requireGi088ModelCallAuthorization,
  requireGi088SmokeAuthorization,
  validateGi088EvaluationDatabaseUrl
} from "../../src/server/services/evaluation/gi088/access";
import {
  GI088_STALE_PROCESSING_AFTER_MS,
  Gi088EvaluationService
} from "../../src/server/services/evaluation/gi088/service";
import { createGi088OutputSchemaIssues } from "../../src/server/services/evaluation/gi088/schema-diagnostics";
import {
  createGi088RetentionSelection,
  summarizeGi088RetentionBatch,
  summarizeGi088RetentionSmoke
} from "../../src/server/services/evaluation/gi088/retention";
import { Gi088MemoryStore } from "../../src/server/services/evaluation/gi088/store";
import {
  createGi088PublicTechnicalSmoke,
  Gi088MemoryTechnicalSmokeStore,
  runGi088TechnicalSmoke
} from "../../src/server/services/evaluation/gi088/technical-smoke";
import {
  AIProviderError,
  attachAIReasoningOnlyContinuation,
  type AICompletionParams,
  type AIProvider,
  type AIProviderDiagnostics
} from "../../src/server/services/ai/ai-provider";

function firstTurnOutput() {
  return JSON.stringify({
    semantic: {
      stage: "engage_focus",
      action: "ask",
      workingTask: {
        continuity: "new",
        targetRef: null,
        summary: "共同弄清用户此刻最想展开的真实困扰",
        evidenceRefs: ["U1"]
      },
      understandingChange: {
        kind: "add",
        summary: "用户已经提供一段当前真实内容",
        evidenceRefs: ["U1"]
      },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "这件事目前最卡住用户的一处具体感受",
        taskEffect: "帮助共同任务找到一个可以继续深入的现实入口",
        evidenceRefs: ["U1"]
      },
      answerOpportunity: "new",
      burdenSignalChange: { kind: "unchanged" },
      pauseReason: null
    },
    visible: {
      understanding: "我先跟着你刚才说的这件事往下看。",
      response: "它目前最卡住你的那一处，具体是什么感受？"
    }
  });
}

function followupOutput(params: AICompletionParams) {
  const modelInput = JSON.parse(params.messages.at(-1)!.content) as {
    conversation: Array<{ id: string; role: string; content: string }>;
    latestUserMessageId: string;
    semanticContext: {
      workingTask: { ref: string; summary: string; evidenceRefs: string[] };
    };
  };
  const latest = modelInput.latestUserMessageId;
  return JSON.stringify({
    semantic: {
      stage: "explore_clarify",
      action: "synthesize",
      workingTask: {
        continuity: "continue",
        targetRef: modelInput.semanticContext.workingTask.ref,
        summary: `${modelInput.semanticContext.workingTask.summary}，并吸收本轮补充`,
        evidenceRefs: [
          ...modelInput.semanticContext.workingTask.evidenceRefs,
          latest
        ]
      },
      understandingChange: {
        kind: "add",
        summary: "本轮补充让当前困扰更具体",
        evidenceRefs: [latest]
      },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: null,
      answerOpportunity: null,
      burdenSignalChange: { kind: "unchanged" },
      pauseReason: null
    },
    visible: {
      understanding: null,
      response: "你刚刚补充的这一点，让这件事为什么卡住你更清楚了。"
    }
  });
}

function stageQuestionOutput(
  params: AICompletionParams,
  stage: "explore_clarify" | "deepen_integrate",
  options: { twoQuestions?: boolean } = {}
) {
  const modelInput = JSON.parse(params.messages.at(-1)!.content) as {
    latestUserMessageId: string;
    semanticContext: {
      workingTask: { ref: string; summary: string; evidenceRefs: string[] };
    };
  };
  const latest = modelInput.latestUserMessageId;
  const task = modelInput.semanticContext.workingTask;
  return JSON.stringify({
    semantic: {
      stage,
      action: "ask",
      workingTask: {
        continuity: "continue",
        targetRef: task.ref,
        summary: task.summary,
        evidenceRefs: [...new Set([...task.evidenceRefs, latest])]
      },
      understandingChange: {
        kind: "add",
        summary: `用户在 ${latest} 补充了当前焦点下的新信息`,
        evidenceRefs: [latest]
      },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "用户最新表达中仍未想明白的一项具体部分",
        taskEffect: "帮助当前共同任务形成更清楚的认识",
        evidenceRefs: [latest]
      },
      answerOpportunity: "new",
      burdenSignalChange: { kind: "unchanged" },
      pauseReason: null
    },
    visible: {
      understanding: "我先承接你刚才补充的这一点。",
      response: options.twoQuestions
        ? "这里最难判断的是什么？你还担心什么？"
        : "这里最难判断的具体部分是什么？"
    }
  });
}

function validProvider() {
  const calls: AICompletionParams[] = [];
  const provider: AIProvider = {
    name: "fake-gi088",
    complete: vi.fn(async (params) => {
      calls.push(params);
      const input = JSON.parse(params.messages.at(-1)!.content) as {
        semanticContext: { workingTask: unknown };
      };
      return {
        content: input.semanticContext.workingTask
          ? followupOutput(params)
          : firstTurnOutput(),
        latencyMs: 7,
        provider: "fake-gi088",
        tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        diagnostics: {
          finishReason: "stop" as const,
          reasoningPresent: false,
          reasoningLength: 0,
          reasoningTokens: 0,
          latencyMs: 7,
          tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          reasoning_content: "PRIVATE_FORMAL_TRAJECTORY_SENTINEL"
        } as unknown as AIProviderDiagnostics
      };
    })
  };
  return { provider, calls };
}

async function completeTask(
  service: Gi088EvaluationService,
  ownerUserId: string,
  taskId: string,
  suffix: string
) {
  await service.startOff({
    ownerUserId,
    taskId,
    initialUserMessage: `这是 ${taskId} 的真实话题 ${suffix}`,
    clientTurnId: `${taskId}-off-u1-${suffix}`
  });
  await service.endTrajectory({
    ownerUserId,
    taskId,
    branch: "off",
    feeling: "same",
    quality: "direct_use",
    targetTrigger: "triggered",
    reason: "关闭组可以直接使用。"
  });
  await service.startHigh({ ownerUserId, taskId });
  await service.endTrajectory({
    ownerUserId,
    taskId,
    branch: "high",
    feeling: "better",
    quality: "direct_use",
    targetTrigger: "triggered",
    reason: "开启组可以直接使用。"
  });
  await service.compare({
    ownerUserId,
    taskId,
    preference: "high_better",
    reason: "开启组的承接更自然。"
  });
}

async function reachStageTransitionViolation(input: {
  service: Gi088EvaluationService;
  ownerUserId: string;
  branch: "off" | "high";
}) {
  await input.service.startOff({
    ownerUserId: input.ownerUserId,
    taskId: "A1",
    initialUserMessage: "我想弄清这次选择为什么让我反复犹豫。",
    clientTurnId: `${input.ownerUserId}-off-u1`
  });
  if (input.branch === "high") {
    await input.service.endTrajectory({
      ownerUserId: input.ownerUserId,
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "关闭分支完成前置对照。"
    });
    await input.service.startHigh({
      ownerUserId: input.ownerUserId,
      taskId: "A1"
    });
  }
  await input.service.submitTurn({
    ownerUserId: input.ownerUserId,
    taskId: "A1",
    branch: input.branch,
    content: "我担心投入以后仍然得不到想要的结果。",
    clientTurnId: `${input.ownerUserId}-${input.branch}-u2`
  });
  await input.service.submitTurn({
    ownerUserId: input.ownerUserId,
    taskId: "A1",
    branch: input.branch,
    content: "这份担心让我一直难以真正做决定。",
    clientTurnId: `${input.ownerUserId}-${input.branch}-u3`
  });
  return input.service.submitTurn({
    ownerUserId: input.ownerUserId,
    taskId: "A1",
    branch: input.branch,
    content: "我仍没想明白，自己真正害怕失去的是机会还是稳定。",
    clientTurnId: `${input.ownerUserId}-${input.branch}-u4`
  });
}

describe("GI-088 Preview evaluation service", () => {
  it("把 v7r2 Ark Flash 候选与历史 v1 至 v7r1 分开版本化并保留治理范围", () => {
    expect({
      id: GI088_EVALUATION_ID,
      version: GI088_EVALUATION_VERSION,
      serviceVersion: GI088_SERVICE_VERSION
    }).toEqual({
      id: "gi088_human_eval_v7r2_ark_flash",
      version: "2026-08-10.gi088-human-eval-v7r2-ark-flash",
      serviceVersion: "2026-08-10.gi088-ark-flash-service-v7r2"
    });
    expect({
      id: GI088_EVALUATION_ID_V7R1,
      version: GI088_EVALUATION_VERSION_V7R1,
      serviceVersion: GI088_SERVICE_VERSION_V7R1
    }).toEqual({
      id: "gi088_human_eval_v7r1_visible_continuation",
      version: "2026-08-10.gi088-human-eval-v7r1-visible-continuation",
      serviceVersion: "2026-08-10.gi088-visible-continuation-service-v7r1"
    });
    expect({
      id: GI088_EVALUATION_ID_V7,
      version: GI088_EVALUATION_VERSION_V7,
      serviceVersion: GI088_SERVICE_VERSION_V7
    }).toEqual({
      id: "gi088_human_eval_v7_continuity_baseline",
      version: "2026-08-09.gi088-human-eval-v7-continuity-baseline",
      serviceVersion: "2026-08-09.gi088-continuity-service-v7"
    });
    expect({
      id: GI088_EVALUATION_ID_V6,
      version: GI088_EVALUATION_VERSION_V6,
      serviceVersion: GI088_SERVICE_VERSION_V6
    }).toEqual({
      id: "gi088_human_eval_v6_single_focus",
      version: "2026-08-09.gi088-human-eval-v6-single-focus",
      serviceVersion: "2026-08-09.gi088-single-focus-service-v6"
    });
    expect({
      id: GI088_EVALUATION_ID_V5,
      version: GI088_EVALUATION_VERSION_V5,
      serviceVersion: GI088_SERVICE_VERSION_V5
    }).toEqual({
      id: "gi088_human_eval_v5_high_reliability",
      version: "2026-08-09.gi088-human-eval-v5-high-reliability",
      serviceVersion: "2026-08-09.gi088-high-reliability-service-v5"
    });
    expect({
      id: GI088_EVALUATION_ID_V4,
      version: GI088_EVALUATION_VERSION_V4,
      serviceVersion: GI088_SERVICE_VERSION_V4
    }).toEqual({
      id: "gi088_human_eval_v4_stage_transition",
      version: "2026-08-09.gi088-human-eval-v4-stage-transition",
      serviceVersion: "2026-08-09.gi088-stage-transition-service-v4"
    });
    expect({
      id: GI088_EVALUATION_ID_V3,
      version: GI088_EVALUATION_VERSION_V3,
      serviceVersion: GI088_SERVICE_VERSION_V3
    }).toEqual({
      id: "gi088_human_eval_v3_empty_recovery",
      version: "2026-08-09.gi088-human-eval-v3-empty-recovery",
      serviceVersion: "2026-08-09.gi088-empty-content-recovery-service-v3"
    });
    expect({
      id: GI088_EVALUATION_ID_V2,
      version: GI088_EVALUATION_VERSION_V2,
      serviceVersion: GI088_SERVICE_VERSION_V2
    }).toEqual({
      id: "gi088_human_eval_v2_diagnostic",
      version: "2026-08-09.gi088-human-eval-v2-diagnostic",
      serviceVersion: "2026-08-09.gi088-diagnostic-service-v2"
    });
    expect({
      id: GI088_EVALUATION_ID_V1,
      version: GI088_EVALUATION_VERSION_V1,
      serviceVersion: GI088_SERVICE_VERSION_V1
    }).toEqual({
      id: "gi088_human_eval_v1",
      version: "2026-08-09.gi088-human-eval-v1",
      serviceVersion: "2026-08-09.gi088-preview-service-v0.6"
    });
    expect(GI088_GOVERNED_EVALUATION_VERSIONS).toEqual([
      GI088_EVALUATION_VERSION_V1,
      GI088_EVALUATION_VERSION_V2,
      GI088_EVALUATION_VERSION_V3,
      GI088_EVALUATION_VERSION_V4,
      GI088_EVALUATION_VERSION_V5,
      GI088_EVALUATION_VERSION_V6,
      GI088_EVALUATION_VERSION_V7,
      GI088_EVALUATION_VERSION_V7R1,
      GI088_EVALUATION_VERSION
    ]);
    expect(createGi088EffectiveCandidateFingerprint()).toMatch(/^[a-f0-9]{64}$/u);
    expect(createGi088DatasetFingerprint()).toMatch(/^[a-f0-9]{64}$/u);
    expect(createGi088ExecutionFingerprint()).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("2 项连续性任务都具备独立触发提示与判定标准", () => {
    expect(GI088_TASKS).toHaveLength(2);
    expect(new Set(GI088_TASKS.map((task) => task.id)).size).toBe(2);
    for (const task of GI088_TASKS) {
      expect(task.targetTriggerPrompt.trim().length).toBeGreaterThan(20);
      expect(task.criterion.trim().length).toBeGreaterThan(20);
    }
  });

  it("v7r2 只启用 Ark Flash Thinking high 并关闭新 Prefix 续写", () => {
    expect(GI088_CONFIGS.high).toMatchObject({
      baseUrlHost: "ark.cn-beijing.volces.com",
      model: "deepseek-v4-flash-ga-260731",
      thinking: "enabled",
      reasoningEffort: "high",
      responseFormat: "json_object",
      activeInEvaluation: true
    });
    expect(GI088_TIMEOUT_POLICY).toMatchObject({
      headersTimeoutMs: 60_000,
      bodyIdleTimeoutMs: 60_000,
      hardTimeoutMs: 60_000
    });
  });

  it("把可部署快照逐字绑定到 GI-087 原 Prompt、Skill 和结构指纹", async () => {
    const packageRoot = resolve(
      process.cwd(),
      "artifacts/generative-interview-board7/2026-08-07-board7b-working-task-v1"
    );
    const clarificationPath = resolve(
      process.cwd(),
      "artifacts/generative-interview-board7/2026-08-08-gi088-human-eval-v0/gi088-output-contract-clarification-v0.1.md"
    );
    const originals = await Promise.all([
      readFile(resolve(packageRoot, "board7b-base-prompt-v1.md"), "utf8"),
      readFile(
        resolve(packageRoot, "conduct-daily-light-thinking-interview/SKILL.md"),
        "utf8"
      ),
      readFile(resolve(packageRoot, "board7b-output-contract-v1.md"), "utf8"),
      readFile(resolve(packageRoot, "board7b-turn-input-v1.md"), "utf8"),
      readFile(clarificationPath, "utf8")
    ]);
    const baseAssets = getGi088BaseCandidateAssets();
    const assets = getGi088CandidateAssets();
    expect(baseAssets.basePrompt).toBe(originals[0].trim());
    expect(baseAssets.interviewSkillSource).toBe(originals[1].trim());
    expect(baseAssets.outputContract).toBe(originals[2].trim());
    expect(baseAssets.turnInputContract).toBe(originals[3].trim());
    expect(assets.basePrompt).toContain(baseAssets.basePrompt);
    expect(assets.basePrompt).toContain(GI088_STAGE_TRANSITION_APPENDICES.basePrompt);
    expect(assets.interviewSkillSource).toContain(baseAssets.interviewSkillSource);
    expect(assets.interviewSkillSource).toContain("## 阶段 2 用完后的自然转场");
    expect(assets.turnInputContract).toContain(baseAssets.turnInputContract);
    expect(assets.turnInputContract).toContain(
      GI088_STAGE_TRANSITION_APPENDICES.turnInputContract
    );
    expect(assets.outputContract).toContain('"understandingChange"');
    expect(assets.outputContract).toContain('"burdenSignalChange"');
    expect(assets.outputContract).not.toContain('"understandingDelta"');
    expect(assets.outputContract).not.toContain('"burdenSignal"');
    expect(verifyGi088CandidateSnapshot()).toMatchObject({
      actualSourceHashes: GI088_ASSET_SOURCE_SHA256,
      baseCandidateFingerprint: GI088_GI087_CANDIDATE_FINGERPRINT,
      effectiveCandidateFingerprint: createGi088EffectiveCandidateFingerprint()
    });
    expect(createGi088EffectiveCandidateFingerprint()).toMatch(/^[a-f0-9]{64}$/u);
    expect(createGi088DatasetFingerprint()).toMatch(/^[a-f0-9]{64}$/u);
    expect(createGi088ExecutionFingerprint()).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("评测触发提示只进入评测元数据指纹，不进入模型 messages 或 requestHash", async () => {
    const store = new Gi088MemoryStore();
    const { provider, calls } = validProvider();
    const service = new Gi088EvaluationService({
      store,
      getProvider: () => provider
    });

    await service.startOff({
      ownerUserId: "owner-metadata-boundary",
      taskId: "A1",
      initialUserMessage: "我想聊聊今天复盘这批评测时的真实感受。",
      clientTurnId: "metadata-boundary-off-u1"
    });

    expect(calls).toHaveLength(1);
    const modelMessages = JSON.stringify(calls[0].messages);
    for (const task of GI088_TASKS) {
      expect(modelMessages).not.toContain(task.targetTriggerPrompt);
      expect(modelMessages).not.toContain(task.criterion);
    }

    const stored = await store.findByOwnerAndVersion(
      "owner-metadata-boundary",
      GI088_EVALUATION_VERSION
    );
    const storedRequestHash =
      stored?.state.tasks[0].branches.off.turns[0].calls[0].requestHash;
    const expectedRequestHash = createHash("sha256")
      .update(JSON.stringify(calls[0]))
      .digest("hex");
    expect(storedRequestHash).toBe(expectedRequestHash);
  });

  it("明确区分负担信号缺席与有证据的负担信号", () => {
    expect(() => parseGi088SemanticDeltaOutput(firstTurnOutput())).not.toThrow();

    const invalid = JSON.parse(firstTurnOutput()) as {
      semantic: { burdenSignalChange: unknown };
    };
    invalid.semantic.burdenSignalChange = {
      kind: "set",
      summary: "未出现明显的负担信号",
      evidenceRefs: []
    };
    expect(() =>
      parseGi088SemanticDeltaOutput(JSON.stringify(invalid))
    ).toThrow();
  });

  it("结构失败只保留白名单路径和错误码", () => {
    const sentinel = "PRIVATE_REASONING_SENTINEL";
    const issues = createGi088OutputSchemaIssues({
      issues: [
        {
          code: "too_small",
          path: ["semantic", "burdenSignal", "evidenceRefs"],
          message: sentinel,
          input: sentinel,
          received: sentinel
        }
      ]
    });
    expect(issues).toEqual([
      "OUTPUT_SCHEMA_INVALID:semantic.burdenSignal.evidenceRefs:too_small"
    ]);
    expect(JSON.stringify(issues)).not.toContain(sentinel);
    expect(createGi088OutputSchemaIssues(new SyntaxError(sentinel))).toEqual([
      "OUTPUT_SCHEMA_INVALID:$:invalid_json"
    ]);
  });

  it("只允许开启的 Vercel Preview 与独立评测 schema", () => {
    const env = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      GI088_EVALUATION_ENABLED: GI088_EVALUATION_ENABLE_VALUE,
      EVALUATION_DATABASE_URL:
        "postgresql://preview:test@example.com/dailylight?schema=gi088_evaluation_v0",
      EVALUATION_POSTGRES_HOST: "example.com",
      EVALUATION_POSTGRES_DATABASE: "dailylight",
      DATABASE_URL:
        "postgresql://preview:test@example.com/dailylight?schema=gi088_app_preview",
      GI088_EVALUATOR_USERNAMES: "product_owner, reviewer"
    } as NodeJS.ProcessEnv;
    expect(canOpenGi088Evaluation(env)).toBe(true);
    expect(validateGi088EvaluationDatabaseUrl(env)).toEqual({
      schema: "gi088_evaluation_v0",
      host: "example.com",
      database: "dailylight"
    });
    expect(parseGi088EvaluatorUsernames(env)).toEqual([
      "product_owner",
      "reviewer"
    ]);
    expect(isGi088EvaluatorUsername("product_owner", {
      ...env,
      ADMIN_USERNAMES: "product_owner"
    })).toBe(true);
    expect(isGi088EvaluatorUsername("reviewer", {
      ...env,
      ADMIN_USERNAMES: "product_owner"
    })).toBe(false);
    expect(parseGi088EvaluatorUsernames({
      ...env,
      ADMIN_USERNAMES: "product_owner",
      GI088_EVALUATOR_USERNAMES: ""
    })).toEqual([]);
    expect(isGi088EvaluatorUsername("product_owner", {
      ...env,
      ADMIN_USERNAMES: "product_owner",
      GI088_EVALUATOR_USERNAMES: ""
    })).toBe(false);
    expect(canOpenGi088Evaluation({ ...env, VERCEL_ENV: "production" })).toBe(false);
    expect(() =>
      requireGi088ModelCallAuthorization("fingerprint", "batch", env)
    ).toThrow("GI088_MODEL_CALL_AUTHORIZATION_REQUIRED");
    expect(() =>
      requireGi088ModelCallAuthorization("fingerprint", "batch", {
        ...env,
        GI088_MODEL_CALL_SCOPE: "batch",
        GI088_AUTHORIZED_EXECUTION_FINGERPRINT: "fingerprint"
      })
    ).not.toThrow();
    expect(
      requireGi088SmokeAuthorization("off", "fingerprint", {
        ...env,
        GI088_MODEL_CALL_SCOPE: "smoke_off",
        GI088_AUTHORIZED_EXECUTION_FINGERPRINT: "fingerprint",
        GI088_SMOKE_AUTHORIZATION_ID: "00000000-0000-4000-8000-000000000101"
      })
    ).toBe("00000000-0000-4000-8000-000000000101");
    expect(() =>
      requireGi088SmokeAuthorization("high", "fingerprint", {
        ...env,
        GI088_MODEL_CALL_SCOPE: "smoke_off",
        GI088_AUTHORIZED_EXECUTION_FINGERPRINT: "fingerprint",
        GI088_SMOKE_AUTHORIZATION_ID: "00000000-0000-4000-8000-000000000101"
      })
    ).toThrow("GI088_MODEL_CALL_AUTHORIZATION_REQUIRED");
    expect(() =>
      validateGi088EvaluationDatabaseUrl({
        ...env,
        EVALUATION_DATABASE_URL:
          "postgresql://preview:test@example.com/dailylight?schema=public"
      })
    ).toThrow("GI088_EVALUATION_DATABASE_SCHEMA_MISMATCH");
    expect(() =>
      validateGi088EvaluationDatabaseUrl({
        ...env,
        EVALUATION_POSTGRES_HOST: "another.example.com"
      })
    ).toThrow("GI088_EVALUATION_DATABASE_IDENTITY_MISMATCH");
    expect(() =>
      validateGi088EvaluationDatabaseUrl({
        ...env,
        DATABASE_URL:
          "postgresql://preview:test@example.com/dailylight?schema=public"
      })
    ).toThrow("GI088_PREVIEW_APP_DATABASE_SCHEMA_MISMATCH");
    expect(() =>
      validateGi088EvaluationDatabaseUrl({
        ...env,
        DATABASE_URL:
          "postgresql://preview:test@other.example.com/dailylight?schema=gi088_app_preview"
      })
    ).toThrow("GI088_PREVIEW_APP_DATABASE_IDENTITY_MISMATCH");
  });

  it("读取工作台创建 2 项进度且保持模型调用为 0", async () => {
    const { provider } = validProvider();
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });
    const session = await service.getSession("owner-1");
    expect(session.batch).toMatchObject({
      status: "running",
      completedTaskCount: 0,
      totalTasks: 2
    });
    expect(session.tasks).toHaveLength(2);
    expect(session.tasks[0].status).toBe("ready");
    expect(session.tasks[0]).toMatchObject({
      targetTriggerPrompt: GI088_TASKS[0].targetTriggerPrompt,
      criterion: GI088_TASKS[0].criterion
    });
    expect(session.tasks.slice(1).every((item) => item.status === "locked")).toBe(true);
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it("High-only 批次从 U1 直接开始 high，评价后完成当前任务", async () => {
    const { provider, calls } = validProvider();
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider,
      evaluationMode: "high_only"
    });

    const initial = await service.getSession("owner-high-only");
    expect(initial.evaluation).toMatchObject({
      mode: "high_only",
      activeBranches: ["high"]
    });
    expect(initial.batch.targetCoverage.totalTrajectoryCount).toBe(2);
    await expect(service.startOff({
      ownerUserId: "owner-high-only",
      taskId: "A1",
      initialUserMessage: "不应进入关闭模式。",
      clientTurnId: "high-only-off"
    })).rejects.toMatchObject({ code: "GI088_HIGH_ONLY_EVALUATION" });

    const started = await service.startHigh({
      ownerUserId: "owner-high-only",
      taskId: "A1",
      initialUserMessage: "我想聊聊最近反复犹豫的一件事。",
      clientTurnId: "high-only-u1"
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      thinking: "enabled",
      reasoningEffort: "high",
      timeoutMs: GI088_TIMEOUT_POLICY.hardTimeoutMs,
      headersTimeoutMs: GI088_TIMEOUT_POLICY.headersTimeoutMs,
      bodyIdleTimeoutMs: GI088_TIMEOUT_POLICY.bodyIdleTimeoutMs,
      hardTimeoutMs: GI088_TIMEOUT_POLICY.hardTimeoutMs
    });
    expect(calls[0]).not.toHaveProperty("reasoningOnlyContinuation");
    expect(started.activeTask).toMatchObject({
      activeBranch: "high",
      frozenStart: { userMessage: "我想聊聊最近反复犹豫的一件事。" },
      branches: {
        off: { status: "not_started", turns: [] },
        high: { status: "running" }
      }
    });

    await service.reviewQuestion({
      ownerUserId: "owner-high-only",
      taskId: "A1",
      branch: "high",
      turnId: started.activeTask!.branches.high.turns[0]!.id,
      classification: "same_focus_low_burden",
      note: "单一回答焦点。"
    });

    const completed = await service.endTrajectory({
      ownerUserId: "owner-high-only",
      taskId: "A1",
      branch: "high",
      feeling: "better",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "High 轨迹可以直接使用。"
    });
    expect(completed.activeTask).toBeNull();
    expect(completed.batch.completedTaskCount).toBe(1);
    expect(completed.tasks[0]?.status).toBe("completed");
    expect(completed.tasks[1]?.status).toBe("ready");
  });

  it("High 多问句按单一回答焦点正常提交并进入逐轮人工复核", async () => {
    const paramsSeen: AICompletionParams[] = [];
    const provider: AIProvider = {
      name: "fake-high-single-focus",
      complete: vi.fn(async (params) => {
        paramsSeen.push(params);
        const parsed = JSON.parse(firstTurnOutput()) as {
          visible: { response: string };
        };
        parsed.visible.response =
          "这种卡住具体是什么感受？是担心做错选择？还是担心失去现在的稳定？";
        return {
          content: JSON.stringify(parsed),
          latencyMs: 9,
          provider: "fake-high-single-focus",
          tokenUsage: null
        };
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider,
      evaluationMode: "high_only"
    });
    const started = await service.startHigh({
      ownerUserId: "owner-high-single-focus",
      taskId: "A1",
      initialUserMessage: "我想聊聊最近反复犹豫的一件事。",
      clientTurnId: "high-single-focus-u1"
    });
    const turn = started.activeTask!.branches.high.turns[0]!;
    expect(paramsSeen).toHaveLength(1);
    expect(turn).toMatchObject({
      status: "valid",
      validationIssues: [],
      recovery: null,
      questionObservation: {
        questionMarkCount: 3,
        reviewCandidate: "multiple_question_marks",
        review: null
      }
    });
    expect(turn.calls).toHaveLength(1);
    expect(started.activeTask!.branches.high.messages.filter(
      (message) => message.role === "assistant"
    )).toHaveLength(2);

    await expect(service.endTrajectory({
      ownerUserId: "owner-high-single-focus",
      taskId: "A1",
      branch: "high",
      feeling: "same",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "回答负担自然。"
    })).rejects.toMatchObject({ code: "GI088_QUESTION_REVIEWS_REQUIRED" });

    const reviewed = await service.reviewQuestion({
      ownerUserId: "owner-high-single-focus",
      taskId: "A1",
      branch: "high",
      turnId: turn.id,
      classification: "same_focus_low_burden",
      note: "三个问句都在帮助说明同一种卡住感。"
    });
    expect(reviewed.activeTask!.branches.high.turns[0]!.questionObservation)
      .toMatchObject({
        review: {
          classification: "same_focus_low_burden",
          note: "三个问句都在帮助说明同一种卡住感。"
        }
      });

    await service.endTrajectory({
      ownerUserId: "owner-high-single-focus",
      taskId: "A1",
      branch: "high",
      feeling: "same",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "回答负担自然。"
    });
    expect(paramsSeen).toHaveLength(1);
  });

  it("相同逐轮分类的并发提交保持幂等，不覆盖人工结论", async () => {
    const { provider } = validProvider();
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider,
      evaluationMode: "high_only"
    });
    const started = await service.startHigh({
      ownerUserId: "owner-question-review-concurrent",
      taskId: "A1",
      initialUserMessage: "我想弄清最近做选择时为什么总会犹豫。",
      clientTurnId: "question-review-concurrent-u1"
    });
    const request = {
      ownerUserId: "owner-question-review-concurrent",
      taskId: "A1",
      branch: "high" as const,
      turnId: started.activeTask!.branches.high.turns[0]!.id,
      classification: "same_focus_low_burden" as const,
      note: "同一焦点。"
    };
    const results = await Promise.all([
      service.reviewQuestion(request),
      service.reviewQuestion(request)
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].activeTask!.branches.high.turns[0]!.questionObservation)
      .toMatchObject({
        review: {
          classification: "same_focus_low_burden",
          note: "同一焦点。"
        }
      });
  });

  it("High 轨迹不设调用上限，第 13 次与第 25 次仍能继续", async () => {
    const { provider } = validProvider();
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider,
      evaluationMode: "high_only"
    });
    const started = await service.startHigh({
      ownerUserId: "owner-trajectory-call-limit",
      taskId: "A1",
      initialUserMessage: "我想用一条长对话检查整条轨迹的调用上限。",
      clientTurnId: "trajectory-call-limit-u1"
    });
    await service.reviewQuestion({
      ownerUserId: "owner-trajectory-call-limit",
      taskId: "A1",
      branch: "high",
      turnId: started.activeTask!.branches.high.turns[0]!.id,
      classification: "same_focus_low_burden",
      note: "首轮只有一个回答焦点。"
    });
    let current = started;
    for (let index = 2; index <= 25; index += 1) {
      current = await service.submitTurn({
        ownerUserId: "owner-trajectory-call-limit",
        taskId: "A1",
        branch: "high",
        content: `这是第 ${index} 次调用对应的真实补充。`,
        clientTurnId: `trajectory-call-limit-u${index}`
      });
    }
    expect(provider.complete).toHaveBeenCalledTimes(25);
    expect(current.activeTask!.branches.high.config).toMatchObject({
      providerCallsUsed: 25,
      providerCallsRemaining: null,
      maximumProviderCallsPerTrajectory: null
    });
    expect(current.activeTask!.branches.high.turns).toHaveLength(25);
  });

  it("已完成任务可以按 taskId 只读回看，下一项仍保持可开始", async () => {
    const { provider } = validProvider();
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider,
      evaluationMode: "high_only"
    });
    const started = await service.startHigh({
      ownerUserId: "owner-completed-task-view",
      taskId: "A1",
      initialUserMessage: "我想验证完成后还能完整回看第一项。",
      clientTurnId: "completed-task-view-u1"
    });
    await service.reviewQuestion({
      ownerUserId: "owner-completed-task-view",
      taskId: "A1",
      branch: "high",
      turnId: started.activeTask!.branches.high.turns[0]!.id,
      classification: "same_focus_low_burden",
      note: "首轮提问可以自然回答。"
    });
    await service.endTrajectory({
      ownerUserId: "owner-completed-task-view",
      taskId: "A1",
      branch: "high",
      feeling: "better",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "第一项已经完成。"
    });

    const latest = await service.getSession("owner-completed-task-view");
    expect(latest.activeTask).toBeNull();
    expect(latest.tasks[0]).toMatchObject({ id: "A1", status: "completed" });
    expect(latest.tasks[1]).toMatchObject({ id: "A2", status: "ready" });

    const history = await service.getSession(
      "owner-completed-task-view",
      "A1"
    );
    expect(history.activeTask).toMatchObject({
      taskId: "A1",
      readOnly: true,
      branches: {
        high: {
          status: "completed",
          review: { quality: "direct_use" }
        }
      }
    });
  });

  it("High 超时只在连接或正文停滞时恢复，60 秒总上限不会盲目重试", async () => {
    const createTimeout = (stage: "body" | "hard_total") =>
      new AIProviderError("deadline", "TIMEOUT", 504, {
        finishReason: null,
        reasoningPresent: null,
        reasoningLength: null,
        reasoningTokens: null,
        latencyMs: stage === "body" ? 45_000 : 60_000,
        tokenUsage: null,
        headersLatencyMs: 430,
        bodyLatencyMs: stage === "body" ? 44_570 : 59_570,
        totalLatencyMs: stage === "body" ? 45_000 : 60_000,
        timeoutStage: stage,
        abortSource: "deadline"
      });
    let bodyAttempts = 0;
    const bodyProvider: AIProvider = {
      name: "fake-body-timeout",
      complete: vi.fn(async () => {
        bodyAttempts += 1;
        if (bodyAttempts === 1) throw createTimeout("body");
        return {
          content: firstTurnOutput(),
          latencyMs: 12,
          provider: "fake-body-timeout",
          tokenUsage: null
        };
      })
    };
    const bodyService = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => bodyProvider,
      evaluationMode: "high_only"
    });
    const bodyFailed = await bodyService.startHigh({
      ownerUserId: "owner-high-body-timeout",
      taskId: "A1",
      initialUserMessage: "我想聊聊最近的一次犹豫。",
      clientTurnId: "high-body-timeout-u1"
    });
    const bodyTurn = bodyFailed.activeTask!.branches.high.turns[0]!;
    expect(bodyTurn.recovery).toMatchObject({
      status: "eligible",
      trigger: "TIMEOUT"
    });
    const recovered = await bodyService.retry({
      ownerUserId: "owner-high-body-timeout",
      taskId: "A1",
      branch: "high",
      turnId: bodyTurn.id,
      trigger: "automatic_timeout"
    });
    expect(bodyAttempts).toBe(2);
    expect(recovered.activeTask!.branches.high.turns[0]).toMatchObject({
      status: "complete_after_auto_recovery",
      recovery: { status: "recovered" }
    });

    const hardProvider: AIProvider = {
      name: "fake-hard-timeout",
      complete: vi.fn(async () => {
        throw createTimeout("hard_total");
      })
    };
    const hardService = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => hardProvider,
      evaluationMode: "high_only"
    });
    const hardFailed = await hardService.startHigh({
      ownerUserId: "owner-high-hard-timeout",
      taskId: "A1",
      initialUserMessage: "我想聊聊最近的一次犹豫。",
      clientTurnId: "high-hard-timeout-u1"
    });
    expect(hardFailed.activeTask!.branches.high.turns[0]!.recovery).toBeNull();
    expect(hardProvider.complete).toHaveBeenCalledTimes(1);
  });

  it("默认 Provider 路径缺少批次指纹授权时在持久化和调用前停止", async () => {
    const previousScope = process.env.GI088_MODEL_CALL_SCOPE;
    const previousFingerprint = process.env.GI088_AUTHORIZED_EXECUTION_FINGERPRINT;
    delete process.env.GI088_MODEL_CALL_SCOPE;
    delete process.env.GI088_AUTHORIZED_EXECUTION_FINGERPRINT;
    const store = new Gi088MemoryStore();
    const service = new Gi088EvaluationService({ store });
    try {
      await expect(
        service.startOff({
          ownerUserId: "owner-locked",
          taskId: "A1",
          initialUserMessage: "这条输入等待候选指纹授权。",
          clientTurnId: "locked-first"
        })
      ).rejects.toThrow("GI088_MODEL_CALL_AUTHORIZATION_REQUIRED");
      expect(
        await store.findByOwnerAndVersion(
          "owner-locked",
          GI088_EVALUATION_VERSION
        )
      ).toBeNull();
      const session = await service.getSession("owner-locked");
      expect(session.activeTask).toBeNull();
      expect(session.tasks[0].status).toBe("ready");
    } finally {
      if (previousScope === undefined) delete process.env.GI088_MODEL_CALL_SCOPE;
      else process.env.GI088_MODEL_CALL_SCOPE = previousScope;
      if (previousFingerprint === undefined) {
        delete process.env.GI088_AUTHORIZED_EXECUTION_FINGERPRINT;
      } else {
        process.env.GI088_AUTHORIZED_EXECUTION_FINGERPRINT = previousFingerprint;
      }
    }
  });

  it("相同 A0+U1 建立隔离分支，唯一差异为 Thinking 参数", async () => {
    const { provider, calls } = validProvider();
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });
    const off = await service.startOff({
      ownerUserId: "owner-2",
      taskId: "A1",
      initialUserMessage: "我最近在一件工作选择上有点纠结。",
      clientTurnId: "a1-u1"
    });
    await service.startOff({
      ownerUserId: "owner-2",
      taskId: "A1",
      initialUserMessage: "我最近在一件工作选择上有点纠结。",
      clientTurnId: "a1-u1"
    });
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(off.activeTask?.branches.off.messages.map((item) => item.id)).toEqual([
      "A0",
      "U1",
      "A1"
    ]);
    await service.endTrajectory({
      ownerUserId: "owner-2",
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "minor_issue",
      targetTrigger: "triggered",
      reason: "整体能用，表达略长。"
    });
    const high = await service.startHigh({ ownerUserId: "owner-2", taskId: "A1" });
    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(calls[0].messages[1].content).toBe(calls[1].messages[1].content);
    expect(calls[0]).toMatchObject({
      temperature: 0.2,
      thinking: "disabled",
      useProviderDefaultMaxTokens: true,
      responseFormat: "json_object"
    });
    expect(Object.hasOwn(calls[0], "maxTokens")).toBe(false);
    expect(Object.hasOwn(calls[1], "temperature")).toBe(false);
    expect(calls[1]).toMatchObject({
      thinking: "enabled",
      reasoningEffort: "high",
      useProviderDefaultMaxTokens: true,
      responseFormat: "json_object"
    });
    expect(Object.hasOwn(calls[1], "maxTokens")).toBe(false);
    expect(high.activeTask?.branches.high.config).toMatchObject({
      effectiveTemperature: null,
      reasoningEffort: "high"
    });
    expect(
      high.activeTask?.branches.high.turns[0]?.calls[0]?.providerDiagnostics
    ).toMatchObject({ finishReason: "stop", reasoningPresent: false });
    expect(JSON.stringify(high)).not.toContain(
      "PRIVATE_FORMAL_TRAJECTORY_SENTINEL"
    );
    expect(high.activeTask?.branches.off.messages).toEqual(
      off.activeTask?.branches.off.messages
    );
  });

  it("off/high 技术冒烟逐次授权、单次消费且不创建正式批次", async () => {
    const { provider, calls } = validProvider();
    const smokeStore = new Gi088MemoryTechnicalSmokeStore();
    const batchStore = new Gi088MemoryStore();
    const off = await runGi088TechnicalSmoke({
      arm: "off",
      authorizationId: "00000000-0000-4000-8000-000000000101",
      store: smokeStore,
      getProvider: () => provider
    });
    const offDuplicate = await runGi088TechnicalSmoke({
      arm: "off",
      authorizationId: "00000000-0000-4000-8000-000000000101",
      store: smokeStore,
      getProvider: () => provider
    });
    const high = await runGi088TechnicalSmoke({
      arm: "high",
      authorizationId: "00000000-0000-4000-8000-000000000102",
      store: smokeStore,
      getProvider: () => provider
    });
    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(offDuplicate.id).toBe(off.id);
    expect(off).toMatchObject({
      arm: "off",
      status: "valid",
      rawFinalOutput: firstTurnOutput()
    });
    expect(high).toMatchObject({
      arm: "high",
      status: "valid",
      rawFinalOutput: firstTurnOutput()
    });
    expect(calls[0]).toMatchObject({ thinking: "disabled", temperature: 0.2 });
    expect(Object.hasOwn(calls[1], "temperature")).toBe(false);
    expect(calls[1]).toMatchObject({
      thinking: "enabled",
      reasoningEffort: "high"
    });
    expect(
      await batchStore.findByOwnerAndVersion(
        "any-owner",
        GI088_EVALUATION_VERSION
      )
    ).toBeNull();
    expect(JSON.stringify({ off, high })).not.toContain("reasoning_content");
  });

  it("技术冒烟为空内容保留安全诊断且不自动重试", async () => {
    const hiddenReasoning = "PRIVATE_GI088_REASONING_SENTINEL";
    const provider: AIProvider = {
      name: "fake-deepseek",
      complete: vi.fn(async () => {
        throw new AIProviderError("Model returned empty content.", "EMPTY_CONTENT", undefined, {
          finishReason: "length",
          reasoningPresent: true,
          reasoningLength: hiddenReasoning.length,
          reasoningTokens: 1600,
          latencyMs: 432,
          tokenUsage: {
            promptTokens: 700,
            completionTokens: 1600,
            totalTokens: 2300
          }
        });
      })
    };
    const record = await runGi088TechnicalSmoke({
      arm: "high",
      authorizationId: "00000000-0000-4000-8000-000000000103",
      store: new Gi088MemoryTechnicalSmokeStore(),
      getProvider: () => provider
    });

    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(record).toMatchObject({
      status: "technical_failure",
      rawFinalOutput: null,
      errorCode: "EMPTY_CONTENT",
      latencyMs: 432,
      tokenUsage: {
        promptTokens: 700,
        completionTokens: 1600,
        totalTokens: 2300
      },
      providerDiagnostics: {
        finishReason: "length",
        reasoningPresent: true,
        reasoningLength: hiddenReasoning.length,
        reasoningTokens: 1600
      }
    });
    expect(JSON.stringify(record)).not.toContain(hiddenReasoning);
    const publicRecord = createGi088PublicTechnicalSmoke(record);
    expect(publicRecord).not.toHaveProperty("authorizationId");
    expect(publicRecord).not.toHaveProperty("requestHash");
    const maliciousPublicRecord = createGi088PublicTechnicalSmoke({
      ...record,
      providerDiagnostics: {
        ...record.providerDiagnostics,
        reasoning_content: hiddenReasoning
      } as unknown as AIProviderDiagnostics
    });
    expect(JSON.stringify(maliciousPublicRecord)).not.toContain(hiddenReasoning);
  });

  it("结构保护失败同样保留供应商诊断摘要", async () => {
    const provider: AIProvider = {
      name: "fake-deepseek",
      complete: vi.fn(async () => ({
        content: '{"semantic":',
        latencyMs: 125,
        provider: "fake-deepseek",
        tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        diagnostics: {
          finishReason: "length" as const,
          reasoningPresent: true,
          reasoningLength: 100,
          reasoningTokens: 18,
          latencyMs: 125,
          tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
        }
      }))
    };
    const record = await runGi088TechnicalSmoke({
      arm: "high",
      authorizationId: "00000000-0000-4000-8000-000000000104",
      store: new Gi088MemoryTechnicalSmokeStore(),
      getProvider: () => provider
    });

    expect(record).toMatchObject({
      status: "protected_failure",
      errorCode: "MODEL_OUTPUT_PROTECTED",
      validationIssues: ["OUTPUT_SCHEMA_INVALID:$:invalid_json"],
      providerDiagnostics: {
        finishReason: "length",
        reasoningTokens: 18
      }
    });
  });

  it("每次发送只产生一次调用，刷新与重复提交不会再次生成", async () => {
    const { provider } = validProvider();
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });
    await service.startOff({
      ownerUserId: "owner-3",
      taskId: "A1",
      initialUserMessage: "最近一件事让我有点卡住。",
      clientTurnId: "first"
    });
    await service.getSession("owner-3");
    await service.submitTurn({
      ownerUserId: "owner-3",
      taskId: "A1",
      branch: "off",
      content: "最卡住的是我不知道要不要继续投入。",
      clientTurnId: "second"
    });
    await service.submitTurn({
      ownerUserId: "owner-3",
      taskId: "A1",
      branch: "off",
      content: "最卡住的是我不知道要不要继续投入。",
      clientTurnId: "second"
    });
    expect(provider.complete).toHaveBeenCalledTimes(2);
    await expect(
      service.submitTurn({
        ownerUserId: "owner-3",
        taskId: "A1",
        branch: "off",
        content: "同一个幂等 ID 被换成另一段内容。",
        clientTurnId: "second"
      })
    ).rejects.toThrow("GI088_IDEMPOTENCY_PAYLOAD_MISMATCH");
    expect(provider.complete).toHaveBeenCalledTimes(2);
    const session = await service.getSession("owner-3");
    expect(session.activeTask?.branches.off.messages.filter((m) => m.role === "user")).toHaveLength(2);
    expect(session.activeTask?.branches.off.turns).toHaveLength(2);
  });

  it("技术失败零自动重试，只有手动重试新增一次调用", async () => {
    const valid = validProvider();
    let attempts = 0;
    const provider: AIProvider = {
      name: "fake-sequential",
      complete: vi.fn(async (params) => {
        attempts += 1;
        if (attempts === 1) throw new Error("temporary network error");
        return valid.provider.complete(params);
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });
    const failed = await service.startOff({
      ownerUserId: "owner-4",
      taskId: "A1",
      initialUserMessage: "最近有点乱。",
      clientTurnId: "first"
    });
    expect(provider.complete).toHaveBeenCalledTimes(1);
    const turnId = failed.activeTask!.branches.off.turns[0].id;
    expect(failed.activeTask?.branches.off.status).toBe("technical_failure");
    const recovered = await service.retry({
      ownerUserId: "owner-4",
      taskId: "A1",
      branch: "off",
      turnId,
      trigger: "manual"
    });
    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(recovered.activeTask?.branches.off.status).toBe("running");
    expect(recovered.activeTask?.branches.off.messages.filter((m) => m.role === "user")).toHaveLength(1);
    expect(recovered.activeTask?.branches.off.turns[0].calls).toHaveLength(2);
  });

  it.each(["off", "high"] as const)(
    "%s 分支在阶段 2 越界后只自动纠正一次并提交一条阶段 3 回应",
    async (branch) => {
      const valid = validProvider();
      const targetCalls: AICompletionParams[] = [];
      const provider: AIProvider = {
        name: "fake-stage-transition-recovery",
        complete: vi.fn(async (params) => {
          const currentBranch = params.thinking === "enabled" ? "high" : "off";
          if (currentBranch !== branch) return valid.provider.complete(params);
          targetCalls.push(params);
          const attempt = targetCalls.length;
          const content = attempt === 1
            ? firstTurnOutput()
            : attempt === 5
              ? stageQuestionOutput(params, "deepen_integrate")
              : stageQuestionOutput(params, "explore_clarify");
          return {
            content,
            latencyMs: 6,
            provider: "fake-stage-transition-recovery",
            tokenUsage: null
          };
        })
      };
      const service = new Gi088EvaluationService({
        store: new Gi088MemoryStore(),
        getProvider: () => provider
      });
      const ownerUserId = `owner-stage-transition-${branch}`;
      const failed = await reachStageTransitionViolation({
        service,
        ownerUserId,
        branch
      });
      const failedTrajectory = failed.activeTask!.branches[branch];
      const failedTurn = failedTrajectory.turns.at(-1)!;
      const assistantCountBeforeRecovery = failedTrajectory.messages.filter(
        (message) => message.role === "assistant"
      ).length;

      expect(targetCalls).toHaveLength(4);
      expect(failedTrajectory).toMatchObject({
        status: "protected_failure",
        pendingTurnId: failedTurn.id
      });
      expect(failedTurn).toMatchObject({
        status: "protected_failure",
        semanticStateAfter: null,
        validationIssues: ["NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"],
        recovery: {
          status: "eligible",
          trigger: "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE",
          automaticRetryCount: 0
        }
      });

      const recovered = await service.retry({
        ownerUserId,
        taskId: "A1",
        branch,
        turnId: failedTurn.id,
        trigger: "automatic_stage_transition"
      });
      const recoveredTrajectory = recovered.activeTask!.branches[branch];
      const recoveredTurn = recoveredTrajectory.turns.at(-1)!;
      const [initialCall, recoveryCall] = recoveredTurn.calls;

      expect(targetCalls).toHaveLength(5);
      expect(targetCalls[4].messages).toEqual([
        targetCalls[3].messages[0],
        {
          role: "system",
          content: GI088_STAGE_TRANSITION_RECOVERY_INSTRUCTION
        },
        targetCalls[3].messages.at(-1)
      ]);
      expect(recoveredTurn).toMatchObject({
        status: "complete_after_auto_recovery",
        validationIssues: ["NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"],
        semantic: { stage: "deepen_integrate", action: "ask" },
        recovery: {
          status: "recovered",
          automaticRetryCount: 1,
          initialCallId: initialCall.id,
          recoveryCallId: recoveryCall.id
        }
      });
      expect(recoveryCall).toMatchObject({
        kind: "automatic_retry",
        parentCallId: initialCall.id,
        retryTrigger: "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE",
        retryOrdinal: 1,
        status: "valid",
        effectiveConfig: expect.objectContaining({
          branch,
          recoveryInstructionVersion:
            "2026-08-09.gi088-stage-transition-recovery-instruction-v1"
        })
      });
      expect(initialCall.requestHash).not.toBe(recoveryCall.requestHash);
      expect(recoveredTrajectory.semanticState.stage).toBe("deepen_integrate");
      expect(
        recoveredTrajectory.messages.filter(
          (message) => message.role === "assistant"
        )
      ).toHaveLength(assistantCountBeforeRecovery + 1);
    }
  );

  it("多问号只作观察，阶段越界仍能独立进入转场恢复", async () => {
    const targetCalls: AICompletionParams[] = [];
    const provider: AIProvider = {
      name: "fake-stage-transition-with-double-question",
      complete: vi.fn(async (params) => {
        targetCalls.push(params);
        const attempt = targetCalls.length;
        const content = attempt === 1
          ? firstTurnOutput()
          : stageQuestionOutput(params, "explore_clarify", {
              twoQuestions: attempt === 4
            });
        return {
          content,
          latencyMs: 6,
          provider: "fake-stage-transition-with-double-question",
          tokenUsage: null
        };
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });
    const failed = await reachStageTransitionViolation({
      service,
      ownerUserId: "owner-stage-transition-multiple-issues",
      branch: "off"
    });
    const turn = failed.activeTask!.branches.off.turns.at(-1)!;

    expect(targetCalls).toHaveLength(4);
    expect(turn.recovery).toMatchObject({
      status: "eligible",
      trigger: "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
    });
    expect(turn.validationIssues).toEqual([
      "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
    ]);
    expect(turn.questionObservation).toMatchObject({
      questionMarkCount: 2,
      reviewCandidate: "multiple_question_marks"
    });
    expect(failed.activeTask?.branches.off.pendingTurnId).toBe(turn.id);
  });

  it("阶段转场自动纠正失败后开放一次人工恢复，重复自动请求不会产生第三次调用", async () => {
    const targetCalls: AICompletionParams[] = [];
    const provider: AIProvider = {
      name: "fake-stage-transition-exhausted",
      complete: vi.fn(async (params) => {
        targetCalls.push(params);
        const attempt = targetCalls.length;
        if (attempt === 5) {
          throw new AIProviderError("empty visible content", "EMPTY_CONTENT");
        }
        return {
          content: attempt === 1
            ? firstTurnOutput()
            : stageQuestionOutput(params, "explore_clarify"),
          latencyMs: 6,
          provider: "fake-stage-transition-exhausted",
          tokenUsage: null
        };
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });
    const ownerUserId = "owner-stage-transition-exhausted";
    const failed = await reachStageTransitionViolation({
      service,
      ownerUserId,
      branch: "off"
    });
    const turnId = failed.activeTask!.branches.off.turns.at(-1)!.id;
    const request = {
      ownerUserId,
      taskId: "A1",
      branch: "off" as const,
      turnId,
      trigger: "automatic_stage_transition" as const
    };

    const exhausted = await service.retry(request);
    expect(targetCalls).toHaveLength(5);
    expect(exhausted.activeTask?.branches.off.turns.at(-1)).toMatchObject({
      status: "technical_failure",
      recovery: {
        status: "manual_available",
        automaticRetryCount: 1,
        trigger: "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
      },
      calls: [
        expect.objectContaining({ status: "protected_failure" }),
        expect.objectContaining({
          status: "technical_failure",
          errorCode: "EMPTY_CONTENT"
        })
      ]
    });
    await service.retry(request);
    await expect(
      service.retry({ ...request, trigger: "automatic_empty_content" })
    ).rejects.toThrow("GI088_TECHNICAL_RETRY_LIMIT_REACHED");
    expect(targetCalls).toHaveLength(5);
  });

  it("两个标签页同时申请阶段转场纠正时只消费一次恢复额度", async () => {
    const targetCalls: AICompletionParams[] = [];
    let recoveryParams: AICompletionParams | null = null;
    let markRecoveryStarted!: () => void;
    const recoveryStarted = new Promise<void>((resolve) => {
      markRecoveryStarted = resolve;
    });
    let finishRecovery!: (
      value: Awaited<ReturnType<AIProvider["complete"]>>
    ) => void;
    const pendingRecovery = new Promise<
      Awaited<ReturnType<AIProvider["complete"]>>
    >((resolve) => {
      finishRecovery = resolve;
    });
    const provider: AIProvider = {
      name: "fake-concurrent-stage-transition",
      complete: vi.fn(async (params) => {
        targetCalls.push(params);
        const attempt = targetCalls.length;
        if (attempt === 5) {
          recoveryParams = params;
          markRecoveryStarted();
          return pendingRecovery;
        }
        return {
          content: attempt === 1
            ? firstTurnOutput()
            : stageQuestionOutput(params, "explore_clarify"),
          latencyMs: 6,
          provider: "fake-concurrent-stage-transition",
          tokenUsage: null
        };
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });
    const ownerUserId = "owner-concurrent-stage-transition";
    const failed = await reachStageTransitionViolation({
      service,
      ownerUserId,
      branch: "off"
    });
    const turnId = failed.activeTask!.branches.off.turns.at(-1)!.id;
    const request = {
      ownerUserId,
      taskId: "A1",
      branch: "off" as const,
      turnId,
      trigger: "automatic_stage_transition" as const
    };

    const first = service.retry(request);
    const second = service.retry(request);
    await recoveryStarted;
    expect(targetCalls).toHaveLength(5);
    finishRecovery({
      content: stageQuestionOutput(recoveryParams!, "deepen_integrate"),
      latencyMs: 7,
      provider: "fake-concurrent-stage-transition",
      tokenUsage: null
    });
    await Promise.allSettled([first, second]);

    const finalSession = await service.getSession(ownerUserId);
    expect(targetCalls).toHaveLength(5);
    expect(finalSession.activeTask?.branches.off.turns.at(-1)).toMatchObject({
      status: "complete_after_auto_recovery",
      recovery: { status: "recovered", automaticRetryCount: 1 }
    });
  });

  it.skip("v3 历史：客户端驱动的空内容恢复", async () => {
    const valid = validProvider();
    const providerCalls: AICompletionParams[] = [];
    const provider: AIProvider = {
      name: "fake-empty-then-valid",
      complete: vi.fn(async (params) => {
        providerCalls.push(params);
        if (providerCalls.length === 2) {
          throw new AIProviderError("empty visible content", "EMPTY_CONTENT", 502, {
            finishReason: "stop",
            reasoningPresent: true,
            reasoningLength: 320,
            reasoningTokens: 320,
            latencyMs: 8,
            tokenUsage: {
              promptTokens: 10,
              completionTokens: 320,
              totalTokens: 330
            },
            httpStatus: 200,
            choiceCount: 1,
            contentType: "string",
            contentLength: 0,
            reasoningType: "string"
          });
        }
        return valid.provider.complete(params);
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });

    await service.startOff({
      ownerUserId: "owner-empty-recovery",
      taskId: "A1",
      initialUserMessage: "我想聊聊最近做选择时反复犹豫的感觉。",
      clientTurnId: "empty-recovery-off"
    });
    await service.endTrajectory({
      ownerUserId: "owner-empty-recovery",
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "关闭组完成。"
    });

    const failed = await service.startHigh({
      ownerUserId: "owner-empty-recovery",
      taskId: "A1"
    });
    const failedTurn = failed.activeTask!.branches.high.turns[0]!;
    expect(provider).toMatchObject({ complete: expect.any(Function) });
    expect(providerCalls).toHaveLength(2);
    expect(failed.activeTask?.branches.high.messages).toHaveLength(2);
    expect(failedTurn).toMatchObject({
      status: "technical_failure",
      semanticStateAfter: null,
      recovery: {
        status: "eligible",
        trigger: "EMPTY_CONTENT",
        automaticRetryCount: 0,
        recoveryCallId: null
      },
      calls: [
        expect.objectContaining({
          kind: "initial",
          errorCode: "EMPTY_CONTENT",
          retryTrigger: null,
          effectiveConfig: expect.objectContaining({
            branch: "high",
            thinking: "enabled",
            reasoningEffort: "high",
            responseFormat: "json_object",
            recoveryInstructionVersion: null
          })
        })
      ]
    });

    const recovered = await service.retry({
      ownerUserId: "owner-empty-recovery",
      taskId: "A1",
      branch: "high",
      turnId: failedTurn.id,
      trigger: "automatic_empty_content"
    });
    const recoveredTrajectory = recovered.activeTask!.branches.high;
    const recoveredTurn = recoveredTrajectory.turns[0]!;
    const [initialCall, recoveryCall] = recoveredTurn.calls;

    expect(providerCalls).toHaveLength(3);
    expect(providerCalls[1]).toMatchObject({
      thinking: "enabled",
      reasoningEffort: "high",
      responseFormat: "json_object"
    });
    expect(providerCalls[2]).toMatchObject({
      thinking: "enabled",
      reasoningEffort: "high",
      responseFormat: "json_object"
    });
    expect(providerCalls[2].messages).toEqual([
      providerCalls[1].messages[0],
      { role: "system", content: GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION },
      providerCalls[1].messages.at(-1)
    ]);
    expect(recoveredTurn).toMatchObject({
      status: "complete_after_auto_recovery",
      recovery: {
        status: "recovered",
        automaticRetryCount: 1,
        initialCallId: initialCall.id,
        recoveryCallId: recoveryCall.id
      }
    });
    expect(recoveryCall).toMatchObject({
      kind: "automatic_retry",
      parentCallId: initialCall.id,
      retryTrigger: "EMPTY_CONTENT",
      retryOrdinal: 1,
      status: "valid",
      effectiveConfig: expect.objectContaining({
        branch: "high",
        thinking: "enabled",
        reasoningEffort: "high",
        responseFormat: "json_object",
        recoveryInstructionVersion:
          "2026-08-09.gi088-empty-content-recovery-instruction-v1"
      })
    });
    expect(initialCall.requestHash).not.toBe(recoveryCall.requestHash);
    expect(
      recoveredTrajectory.messages.filter((message) => message.role === "assistant")
    ).toHaveLength(2);
  });

  it.skip("v3 历史：空内容自动恢复失败后开放人工恢复", async () => {
    const valid = validProvider();
    let providerCallCount = 0;
    const provider: AIProvider = {
      name: "fake-empty-twice",
      complete: vi.fn(async (params) => {
        providerCallCount += 1;
        if (providerCallCount === 1) return valid.provider.complete(params);
        throw new AIProviderError("empty visible content", "EMPTY_CONTENT", 502, {
          finishReason: "stop",
          reasoningPresent: true,
          reasoningLength: 300,
          reasoningTokens: 300,
          latencyMs: 5,
          tokenUsage: {
            promptTokens: 10,
            completionTokens: 300,
            totalTokens: 310
          },
          httpStatus: 200,
          choiceCount: 1,
          contentType: "string",
          contentLength: 0,
          reasoningType: "string"
        });
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });

    await service.startOff({
      ownerUserId: "owner-empty-exhausted",
      taskId: "A1",
      initialUserMessage: "我想聊聊最近难以收住注意力的状态。",
      clientTurnId: "empty-exhausted-off"
    });
    await service.endTrajectory({
      ownerUserId: "owner-empty-exhausted",
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "关闭组完成。"
    });
    const failed = await service.startHigh({
      ownerUserId: "owner-empty-exhausted",
      taskId: "A1"
    });
    const turnId = failed.activeTask!.branches.high.turns[0]!.id;
    const exhausted = await service.retry({
      ownerUserId: "owner-empty-exhausted",
      taskId: "A1",
      branch: "high",
      turnId,
      trigger: "automatic_empty_content"
    });

    expect(provider.complete).toHaveBeenCalledTimes(3);
    expect(exhausted.activeTask?.branches.high.turns[0]).toMatchObject({
      status: "technical_failure",
      recovery: {
        status: "manual_available",
        automaticRetryCount: 1
      },
      calls: [
        expect.objectContaining({ errorCode: "EMPTY_CONTENT" }),
        expect.objectContaining({
          kind: "automatic_retry",
          errorCode: "EMPTY_CONTENT"
        })
      ]
    });

    const duplicate = await service.retry({
      ownerUserId: "owner-empty-exhausted",
      taskId: "A1",
      branch: "high",
      turnId,
      trigger: "automatic_empty_content"
    });
    expect(duplicate.activeTask?.branches.high.turns[0].recovery?.status).toBe(
      "manual_available"
    );
    expect(provider.complete).toHaveBeenCalledTimes(3);
    await expect(
      service.retry({
        ownerUserId: "owner-empty-exhausted",
        taskId: "A1",
        branch: "high",
        turnId,
        trigger: "manual"
      })
    ).rejects.toThrow("GI088_TECHNICAL_RETRY_LIMIT_REACHED");
    expect(provider.complete).toHaveBeenCalledTimes(3);
  });

  it.skip("v7 历史：客户端人工第三次恢复并发", async () => {
    const valid = validProvider();
    let providerCallCount = 0;
    let manualParams: AICompletionParams | null = null;
    let markManualStarted!: () => void;
    const manualStarted = new Promise<void>((resolve) => {
      markManualStarted = resolve;
    });
    let finishManual!: (
      value: Awaited<ReturnType<AIProvider["complete"]>>
    ) => void;
    const pendingManual = new Promise<
      Awaited<ReturnType<AIProvider["complete"]>>
    >((resolve) => {
      finishManual = resolve;
    });
    const provider: AIProvider = {
      name: "fake-manual-third-success",
      complete: vi.fn(async (params) => {
        providerCallCount += 1;
        if (providerCallCount === 1) return valid.provider.complete(params);
        if (providerCallCount === 2 || providerCallCount === 3) {
          throw new AIProviderError("empty visible content", "EMPTY_CONTENT");
        }
        manualParams = params;
        markManualStarted();
        return pendingManual;
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });

    await service.startOff({
      ownerUserId: "owner-manual-third-success",
      taskId: "A1",
      initialUserMessage: "我想聊聊最近反复犹豫的一件事。",
      clientTurnId: "manual-third-off"
    });
    await service.endTrajectory({
      ownerUserId: "owner-manual-third-success",
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "关闭组完成。"
    });
    const failed = await service.startHigh({
      ownerUserId: "owner-manual-third-success",
      taskId: "A1"
    });
    const turnId = failed.activeTask!.branches.high.turns[0]!.id;
    const afterAuto = await service.retry({
      ownerUserId: "owner-manual-third-success",
      taskId: "A1",
      branch: "high",
      turnId,
      trigger: "automatic_empty_content"
    });
    expect(afterAuto.activeTask?.branches.high.turns[0].recovery?.status)
      .toBe("manual_available");

    const request = {
      ownerUserId: "owner-manual-third-success",
      taskId: "A1",
      branch: "high" as const,
      turnId,
      trigger: "manual_after_auto_recovery" as const
    };
    const first = service.retry(request);
    const second = service.retry(request);
    await manualStarted;
    expect(provider.complete).toHaveBeenCalledTimes(4);
    finishManual(await valid.provider.complete(manualParams!));
    await Promise.allSettled([first, second]);

    const finalSession = await service.getSession("owner-manual-third-success");
    const trajectory = finalSession.activeTask!.branches.high;
    const turn = trajectory.turns[0]!;
    expect(turn).toMatchObject({
      status: "complete_after_manual_recovery",
      recovery: {
        status: "recovered",
        automaticRetryCount: 1,
        manualRetryCount: 1
      }
    });
    expect(turn.calls).toHaveLength(3);
    expect(turn.calls[2]).toMatchObject({
      kind: "manual_retry",
      parentCallId: turn.calls[1]!.id,
      retryTrigger: "EMPTY_CONTENT",
      retryOrdinal: 2,
      status: "valid"
    });
    expect(new Set(turn.calls.map((call) => call.requestHash)).size).toBe(2);
    expect(
      trajectory.messages.filter((message) => message.role === "assistant")
    ).toHaveLength(2);
    await service.retry(request);
    expect(provider.complete).toHaveBeenCalledTimes(4);
  });

  it.skip("v7 历史：人工第三次失败后停止", async () => {
    const valid = validProvider();
    let providerCallCount = 0;
    const provider: AIProvider = {
      name: "fake-manual-third-failure",
      complete: vi.fn(async (params) => {
        providerCallCount += 1;
        if (providerCallCount === 1) return valid.provider.complete(params);
        throw new AIProviderError("empty visible content", "EMPTY_CONTENT");
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });

    await service.startOff({
      ownerUserId: "owner-manual-third-failure",
      taskId: "A1",
      initialUserMessage: "我想聊聊最近很难继续的一件事。",
      clientTurnId: "manual-third-failure-off"
    });
    await service.endTrajectory({
      ownerUserId: "owner-manual-third-failure",
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "关闭组完成。"
    });
    const failed = await service.startHigh({
      ownerUserId: "owner-manual-third-failure",
      taskId: "A1"
    });
    const turnId = failed.activeTask!.branches.high.turns[0]!.id;
    await service.retry({
      ownerUserId: "owner-manual-third-failure",
      taskId: "A1",
      branch: "high",
      turnId,
      trigger: "automatic_empty_content"
    });
    const finalFailure = await service.retry({
      ownerUserId: "owner-manual-third-failure",
      taskId: "A1",
      branch: "high",
      turnId,
      trigger: "manual_after_auto_recovery"
    });

    expect(provider.complete).toHaveBeenCalledTimes(4);
    expect(finalFailure.activeTask?.branches.high.turns[0]).toMatchObject({
      status: "technical_failure",
      recovery: {
        status: "exhausted",
        automaticRetryCount: 1,
        manualRetryCount: 1
      }
    });
    const duplicate = await service.retry({
      ownerUserId: "owner-manual-third-failure",
      taskId: "A1",
      branch: "high",
      turnId,
      trigger: "manual_after_auto_recovery"
    });
    expect(duplicate.activeTask?.branches.high.turns[0].recovery?.status)
      .toBe("exhausted");
    expect(provider.complete).toHaveBeenCalledTimes(4);
  });

  it.skip("v3 历史：两个标签页申请客户端空内容恢复", async () => {
    const valid = validProvider();
    let providerCallCount = 0;
    let recoveryParams: AICompletionParams | null = null;
    let markRecoveryStarted!: () => void;
    const recoveryStarted = new Promise<void>((resolve) => {
      markRecoveryStarted = resolve;
    });
    let finishRecovery!: (
      value: Awaited<ReturnType<AIProvider["complete"]>>
    ) => void;
    const pendingRecovery = new Promise<
      Awaited<ReturnType<AIProvider["complete"]>>
    >((resolve) => {
      finishRecovery = resolve;
    });
    const provider: AIProvider = {
      name: "fake-concurrent-recovery",
      complete: vi.fn(async (params) => {
        providerCallCount += 1;
        if (providerCallCount === 1) return valid.provider.complete(params);
        if (providerCallCount === 2) {
          throw new AIProviderError("empty visible content", "EMPTY_CONTENT");
        }
        recoveryParams = params;
        markRecoveryStarted();
        return pendingRecovery;
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });

    await service.startOff({
      ownerUserId: "owner-concurrent-recovery",
      taskId: "A1",
      initialUserMessage: "我想聊聊这次决定为什么让我反复犹豫。",
      clientTurnId: "concurrent-recovery-off"
    });
    await service.endTrajectory({
      ownerUserId: "owner-concurrent-recovery",
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "关闭组完成。"
    });
    const failed = await service.startHigh({
      ownerUserId: "owner-concurrent-recovery",
      taskId: "A1"
    });
    const turnId = failed.activeTask!.branches.high.turns[0]!.id;
    const request = {
      ownerUserId: "owner-concurrent-recovery",
      taskId: "A1",
      branch: "high" as const,
      turnId,
      trigger: "automatic_empty_content" as const
    };

    const first = service.retry(request);
    const second = service.retry(request);
    await recoveryStarted;
    expect(provider.complete).toHaveBeenCalledTimes(3);
    finishRecovery(await valid.provider.complete(recoveryParams!));
    await Promise.allSettled([first, second]);

    const finalSession = await service.getSession("owner-concurrent-recovery");
    expect(provider.complete).toHaveBeenCalledTimes(3);
    expect(finalSession.activeTask?.branches.high.turns[0]).toMatchObject({
      status: "complete_after_auto_recovery",
      recovery: {
        status: "recovered",
        automaticRetryCount: 1
      }
    });
  });

  it.skip("v3 历史：空内容恢复结构失败", async () => {
    const valid = validProvider();
    let providerCallCount = 0;
    const provider: AIProvider = {
      name: "fake-recovery-protected",
      complete: vi.fn(async (params) => {
        providerCallCount += 1;
        if (providerCallCount === 1) return valid.provider.complete(params);
        if (providerCallCount === 2) {
          throw new AIProviderError("empty visible content", "EMPTY_CONTENT");
        }
        return {
          content: "{",
          latencyMs: 3,
          provider: "fake-recovery-protected",
          tokenUsage: null
        };
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });
    await service.startOff({
      ownerUserId: "owner-recovery-protected",
      taskId: "A1",
      initialUserMessage: "我想聊聊最近这件让我分心的事。",
      clientTurnId: "recovery-protected-off"
    });
    await service.endTrajectory({
      ownerUserId: "owner-recovery-protected",
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "关闭组完成。"
    });
    const failed = await service.startHigh({
      ownerUserId: "owner-recovery-protected",
      taskId: "A1"
    });
    const turnId = failed.activeTask!.branches.high.turns[0]!.id;
    const protectedResult = await service.retry({
      ownerUserId: "owner-recovery-protected",
      taskId: "A1",
      branch: "high",
      turnId,
      trigger: "automatic_empty_content"
    });

    expect(provider.complete).toHaveBeenCalledTimes(3);
    expect(protectedResult.activeTask?.branches.high).toMatchObject({
      status: "protected_failure",
      pendingTurnId: expect.any(String),
      turns: [
        expect.objectContaining({
          status: "protected_failure",
          recovery: expect.objectContaining({ status: "manual_available" })
        })
      ]
    });
    await service.retry({
      ownerUserId: "owner-recovery-protected",
      taskId: "A1",
      branch: "high",
      turnId,
      trigger: "automatic_empty_content"
    });
    expect(provider.complete).toHaveBeenCalledTimes(3);
  });

  it("v7r2 收到旧 Prefix continuation 载荷时释放隐藏思考并转入普通空内容恢复", async () => {
    const continuationConsume = vi.fn();
    const continuationDispose = vi.fn();
    const provider: AIProvider = {
      name: "fake-v7r2-no-prefix",
      complete: vi.fn(async () => {
        const error = new AIProviderError(
          "empty visible content",
          "EMPTY_CONTENT",
          undefined,
          {
            finishReason: "stop",
            reasoningPresent: true,
            reasoningLength: 321,
            reasoningTokens: 321,
            latencyMs: 5,
            tokenUsage: null,
            httpStatus: 200,
            choiceCount: 1,
            contentType: "string",
            contentLength: 0,
            reasoningType: "string"
          }
        );
        throw attachAIReasoningOnlyContinuation(error, {
          kind: "deepseek_chat_prefix_beta",
          consume: continuationConsume,
          dispose: continuationDispose
        });
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      evaluationMode: "high_only",
      getProvider: () => provider
    });
    const session = await service.startHigh({
      ownerUserId: "owner-v7r2-no-prefix",
      taskId: "A1",
      initialUserMessage: "我想聊聊最近反复纠结的一件事。",
      clientTurnId: "v7r2-no-prefix-u1"
    });
    const trajectory = session.activeTask!.branches.high;
    const turn = trajectory.turns[0]!;
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(continuationConsume).not.toHaveBeenCalled();
    expect(continuationDispose).toHaveBeenCalledTimes(1);
    expect(turn).toMatchObject({
      status: "technical_failure",
      recovery: {
        status: "eligible",
        trigger: "EMPTY_CONTENT",
        automaticRetryCount: 0
      },
      calls: [
        expect.objectContaining({
          status: "technical_failure",
          errorCode: "EMPTY_CONTENT"
        })
      ]
    });
    expect(trajectory.messages.filter((message) => message.role === "assistant"))
      .toHaveLength(1);
  });

  it("v7r2 普通空内容自动恢复失败后开放一次人工 high 并停止调用链", async () => {
    const valid = validProvider();
    const provider: AIProvider = {
      name: "fake-v7r2-empty-chain",
      complete: vi.fn(async (params) => {
        if (vi.mocked(provider.complete).mock.calls.length <= 2) {
          throw new AIProviderError("empty", "EMPTY_CONTENT");
        }
        return valid.provider.complete(params);
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      evaluationMode: "high_only",
      getProvider: () => provider
    });
    const failed = await service.startHigh({
      ownerUserId: "owner-v7r2-manual",
      taskId: "A1",
      initialUserMessage: "我想聊聊最近很卡住的一件事。",
      clientTurnId: "v7r2-manual-u1"
    });
    const turnId = failed.activeTask!.branches.high.turns[0]!.id;
    expect(failed.activeTask!.branches.high.turns[0]).toMatchObject({
      status: "technical_failure",
      recovery: { status: "eligible", automaticRetryCount: 0 }
    });
    const automaticFailed = await service.retry({
      ownerUserId: "owner-v7r2-manual",
      taskId: "A1",
      branch: "high",
      turnId,
      trigger: "automatic_empty_content"
    });
    expect(automaticFailed.activeTask!.branches.high.turns[0]).toMatchObject({
      status: "technical_failure",
      recovery: { status: "manual_available", automaticRetryCount: 1 }
    });
    const recovered = await service.retry({
      ownerUserId: "owner-v7r2-manual",
      taskId: "A1",
      branch: "high",
      turnId,
      trigger: "manual_after_auto_recovery"
    });
    const turn = recovered.activeTask!.branches.high.turns[0]!;
    expect(provider.complete).toHaveBeenCalledTimes(3);
    expect(turn.status).toBe("complete_after_manual_recovery");
    expect(turn.calls).toHaveLength(3);
    expect(turn.calls[2]).toMatchObject({
      kind: "manual_retry",
      retryOrdinal: 2,
      effectiveConfig: expect.objectContaining({ continuationMode: null })
    });
  });

  it("技术失败可以保留失败证据并由产品负责人直接结束评价", async () => {
    const provider: AIProvider = {
      name: "fake-always-fails",
      complete: vi.fn(async () => {
        throw new Error("provider returned empty content");
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });
    const failed = await service.startOff({
      ownerUserId: "owner-technical-review",
      taskId: "A1",
      initialUserMessage: "我想聊聊刚才练习遇到的困难。",
      clientTurnId: "first"
    });
    const turnId = failed.activeTask!.branches.off.turns[0]!.id;

    expect(failed.activeTask?.branches.off).toMatchObject({
      status: "technical_failure",
      pendingTurnId: turnId
    });

    const reviewed = await service.endTrajectory({
      ownerUserId: "owner-technical-review",
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "quality_failure",
      targetTrigger: "blocked_by_technical_failure",
      reason: "模型连续没有返回可见回应，我选择保留失败并结束当前分支。"
    });

    expect(reviewed.activeTask?.branches.off).toMatchObject({
      status: "completed",
      pendingTurnId: null,
      review: {
        feeling: "same",
        quality: "quality_failure"
      }
    });
    await expect(
      service.retry({
        ownerUserId: "owner-technical-review",
        taskId: "A1",
        branch: "off",
        turnId,
        trigger: "manual"
      })
    ).rejects.toThrow("GI088_TECHNICAL_RETRY_UNAVAILABLE");
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it("刷新不重发，陈旧 processing 转为可手动重试并保留原调用", async () => {
    let currentTime = new Date("2026-08-08T12:00:00.000Z");
    let markProviderStarted!: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      markProviderStarted = resolve;
    });
    let finishProvider!: (value: Awaited<ReturnType<AIProvider["complete"]>>) => void;
    const pendingCompletion = new Promise<Awaited<ReturnType<AIProvider["complete"]>>>(
      (resolve) => {
        finishProvider = resolve;
      }
    );
    const provider: AIProvider = {
      name: "fake-hanging",
      complete: vi.fn(async () => {
        markProviderStarted();
        return pendingCompletion;
      })
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider,
      now: () => currentTime
    });
    const inFlight = service.startOff({
      ownerUserId: "owner-stale",
      taskId: "A1",
      initialUserMessage: "这次请求会在服务端中断。",
      clientTurnId: "stale-first"
    });
    await providerStarted;
    const fresh = await service.getSession("owner-stale");
    expect(fresh.activeTask?.branches.off.status).toBe("running");
    expect(provider.complete).toHaveBeenCalledTimes(1);

    currentTime = new Date(
      currentTime.getTime() + GI088_STALE_PROCESSING_AFTER_MS + 1
    );
    const recovered = await service.getSession("owner-stale");
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(recovered.activeTask?.branches.off).toMatchObject({
      status: "technical_failure",
      technicalError: "REQUEST_INTERRUPTED"
    });
    expect(recovered.activeTask?.branches.off.turns[0]).toMatchObject({
      status: "technical_failure",
      calls: [
        expect.objectContaining({
          kind: "initial",
          status: "technical_failure",
          errorCode: "REQUEST_INTERRUPTED"
        })
      ]
    });
    finishProvider({
      content: firstTurnOutput(),
      latencyMs: 1,
      provider: "fake-hanging",
      tokenUsage: null
    });
    await expect(inFlight).rejects.toThrow("GI088_CONCURRENT_UPDATE");
  });

  it("结构保护失败保留证据、禁止技术重试并允许产品裁决", async () => {
    const provider: AIProvider = {
      name: "fake-invalid",
      complete: vi.fn(async () => ({
        content: "{",
        latencyMs: 3,
        provider: "fake-invalid",
        tokenUsage: null
      }))
    };
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });
    const failed = await service.startOff({
      ownerUserId: "owner-5",
      taskId: "A1",
      initialUserMessage: "我想聊聊最近的压力。",
      clientTurnId: "first"
    });
    const turnId = failed.activeTask!.branches.off.turns[0].id;
    expect(failed.activeTask?.branches.off).toMatchObject({
      status: "protected_failure",
      pendingTurnId: null,
      technicalError: null
    });
    await expect(
      service.retry({
        ownerUserId: "owner-5",
        taskId: "A1",
        branch: "off",
        turnId,
        trigger: "manual"
      })
    ).rejects.toThrow("GI088_TECHNICAL_RETRY_UNAVAILABLE");
    const reviewed = await service.endTrajectory({
      ownerUserId: "owner-5",
      taskId: "A1",
      branch: "off",
      feeling: "worse",
      quality: "single_case_blocker",
      targetTrigger: "not_triggered",
      reason: "结构失败导致用户看不到有效回应。"
    });
    expect(reviewed.activeTask?.branches.off.status).toBe("completed");
  });

  it("只有轨迹存在技术失败证据时才接受技术阻断目标判断", async () => {
    const { provider } = validProvider();
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });
    await service.startOff({
      ownerUserId: "owner-trigger-evidence",
      taskId: "A1",
      initialUserMessage: "这条轨迹成功返回，不含技术失败。",
      clientTurnId: "trigger-evidence-off"
    });

    await expect(service.endTrajectory({
      ownerUserId: "owner-trigger-evidence",
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "minor_issue",
      targetTrigger: "blocked_by_technical_failure",
      reason: "尝试在缺少技术证据时标记技术阻断。"
    })).rejects.toThrow("GI088_TARGET_TRIGGER_TECHNICAL_EVIDENCE_REQUIRED");

    await expect(service.endTrajectory({
      ownerUserId: "owner-trigger-evidence",
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "minor_issue",
      targetTrigger: "not_triggered",
      reason: "仍然可以按实际体验记录任务目标未触发。"
    })).resolves.toMatchObject({
      activeTask: {
        branches: { off: { status: "completed" } }
      }
    });
  });

  it("保留期清理覆盖 v1 至 v7r2 全部批次与 GI-088 全部历史冒烟", () => {
    const selection = createGi088RetentionSelection();
    expect(selection).toEqual({
      batchWhere: {
        evaluationVersion: {
          in: [
            GI088_EVALUATION_VERSION_V1,
            GI088_EVALUATION_VERSION_V2,
            GI088_EVALUATION_VERSION_V3,
            GI088_EVALUATION_VERSION_V4,
            GI088_EVALUATION_VERSION_V5,
            GI088_EVALUATION_VERSION_V6,
            GI088_EVALUATION_VERSION_V7,
            GI088_EVALUATION_VERSION_V7R1,
            GI088_EVALUATION_VERSION
          ]
        }
      },
      smokeWhere: {}
    });
    expect(selection.batchWhere).not.toHaveProperty("status");
    expect(selection.smokeWhere).not.toHaveProperty("status");

    expect(summarizeGi088RetentionBatch({
      id: "running-batch",
      evaluationVersion: "2026-08-08.gi088-human-eval-v0",
      candidateFingerprint: "c".repeat(64),
      executionFingerprint: "e".repeat(64),
      status: "running",
      sealedAt: null,
      state: { tasks: [{ id: "A1" }, { id: "A2" }] }
    })).toMatchObject({
      batchId: "running-batch",
      status: "running",
      sealedAt: null,
      taskCount: 2,
      completedTaskCount: 0,
      notRunTaskCount: 0
    });
    expect(summarizeGi088RetentionBatch({
      id: "high-only-early-stop",
      evaluationVersion: GI088_EVALUATION_VERSION,
      candidateFingerprint: "c".repeat(64),
      executionFingerprint: "e".repeat(64),
      status: "early_stopped",
      sealedAt: new Date("2026-08-10T00:00:00.000Z"),
      state: {
        evaluationMode: "high_only",
        tasks: [
          { branches: { high: { review: { quality: "direct_use" } } } },
          { branches: { high: { review: null } } }
        ]
      }
    })).toMatchObject({
      taskCount: 2,
      completedTaskCount: 1,
      notRunTaskCount: 1
    });
    expect(summarizeGi088RetentionSmoke({
      id: "processing-smoke",
      executionFingerprint: "e".repeat(64),
      arm: "high",
      authorizationId: "authorization-id",
      status: "processing",
      createdAt: new Date("2026-08-08T00:00:00.000Z"),
      completedAt: null
    })).toMatchObject({
      smokeId: "processing-smoke",
      status: "processing",
      completedAt: null
    });
  });

  it("只在任务边界提前结束，部分导出把剩余任务标为未执行并进入只读", async () => {
    const { provider } = validProvider();
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });

    await expect(service.earlyStop({
      ownerUserId: "owner-early-stop",
      reasonCode: "mixed",
      reason: "当前证据充分，同时技术问题已经影响评测体验。"
    })).rejects.toThrow("GI088_EARLY_STOP_TASK_BOUNDARY_REQUIRED");

    await service.startOff({
      ownerUserId: "owner-early-stop",
      taskId: "A1",
      initialUserMessage: "我想用第一项真实话题完成本批检查。",
      clientTurnId: "early-stop-a1-off"
    });
    await expect(service.earlyStop({
      ownerUserId: "owner-early-stop",
      reasonCode: "mixed",
      reason: "当前还在任务内部。"
    })).rejects.toThrow("GI088_EARLY_STOP_TASK_BOUNDARY_REQUIRED");

    await service.endTrajectory({
      ownerUserId: "owner-early-stop",
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "minor_issue",
      targetTrigger: "not_triggered",
      reason: "体验可以评价，但页面任务目标没有真正触发。"
    });
    await service.startHigh({ ownerUserId: "owner-early-stop", taskId: "A1" });
    await service.endTrajectory({
      ownerUserId: "owner-early-stop",
      taskId: "A1",
      branch: "high",
      feeling: "better",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "任务目标已经触发，回应可以直接使用。"
    });
    await service.compare({
      ownerUserId: "owner-early-stop",
      taskId: "A1",
      preference: "high_better",
      reason: "开启组更贴合这次任务。"
    });

    const stopped = await service.earlyStop({
      ownerUserId: "owner-early-stop",
      reasonCode: "mixed",
      reason: "当前证据充分，同时技术问题已经影响评测体验。"
    });
    expect(stopped.batch).toMatchObject({
      status: "early_stopped",
      completedTaskCount: 1,
      targetCoverage: {
        triggeredTrajectoryCount: 1,
        reviewedTrajectoryCount: 2,
        totalTrajectoryCount: 4
      }
    });
    expect(stopped.batch.sealedAt).toBe(stopped.batch.earlyStop?.stoppedAt);
    expect(stopped.tasks[0]).toMatchObject({
      status: "completed",
      targetTriggers: { off: "not_triggered", high: "triggered" }
    });
    expect(stopped.tasks.slice(1).every((task) => task.status === "not_run")).toBe(true);

    const exported = await service.export("owner-early-stop");
    expect(exported.exportVersion).toBe("2026-08-09.gi088-readonly-export-v0.5");
    expect(exported.completion).toMatchObject({
      status: "early_stopped",
      terminalAt: stopped.batch.sealedAt,
      completedTaskIds: ["A1"]
    });
    expect(exported.completion.notRunTaskIds).toHaveLength(1);
    expect(exported.batch.tasks[1].status).toBe("not_run");
    await expect(
      service.startOff({
        ownerUserId: "owner-early-stop",
        taskId: "A2",
        initialUserMessage: "终态后不能继续。",
        clientTurnId: "after-early-stop"
      })
    ).rejects.toThrow("GI088_BATCH_ALREADY_EARLY_STOPPED");
  });

  it("提前结束拒绝任何残留活动或运行痕迹的剩余任务", async () => {
    const { provider } = validProvider();
    const store = new Gi088MemoryStore();
    const service = new Gi088EvaluationService({ store, getProvider: () => provider });
    await completeTask(service, "owner-pristine-boundary", "A1", "pristine");
    const stored = await store.findByOwnerAndVersion(
      "owner-pristine-boundary",
      GI088_EVALUATION_VERSION
    );
    expect(stored).not.toBeNull();
    const state = structuredClone(stored!.state);
    state.tasks[1]!.branches.off.technicalError = "STALE_REMAINDER";
    expect(await store.compareAndSet({
      id: stored!.id,
      expectedRevision: stored!.revision,
      status: "running",
      state,
      sealedAt: null
    })).toBe(true);

    await expect(service.earlyStop({
      ownerUserId: "owner-pristine-boundary",
      reasonCode: "sufficient_evidence",
      reason: "剩余任务存在残留状态时不能提前结束。"
    })).rejects.toThrow("GI088_EARLY_STOP_TASK_BOUNDARY_REQUIRED");
  });

  it("存储层拒绝状态、终态时间和提前结束记录不一致", async () => {
    const store = new Gi088MemoryStore();
    const { provider } = validProvider();
    const service = new Gi088EvaluationService({ store, getProvider: () => provider });
    await service.getSession("owner-terminal-coherence");
    const stored = await store.findByOwnerAndVersion(
      "owner-terminal-coherence",
      GI088_EVALUATION_VERSION
    );
    expect(stored).not.toBeNull();
    const state = structuredClone(stored!.state);
    const terminalAt = "2026-08-09T12:00:00.000Z";
    state.status = "early_stopped";
    state.sealedAt = terminalAt;
    state.earlyStop = {
      reasonCode: "other",
      reason: "构造终态一致性检查。",
      stoppedAt: terminalAt,
      completedTaskIds: [],
      remainingTaskIds: state.tasks.map((task) => task.taskId)
    };

    await expect(store.compareAndSet({
      id: stored!.id,
      expectedRevision: stored!.revision,
      status: "early_stopped",
      state,
      sealedAt: null
    })).rejects.toThrow("GI088_BATCH_PERSISTENCE_STATE_INVALID");
  });

  it("部分导出拒绝终态后被污染的未执行范围", async () => {
    const { provider } = validProvider();
    const store = new Gi088MemoryStore();
    const service = new Gi088EvaluationService({ store, getProvider: () => provider });
    await completeTask(service, "owner-corrupt-export", "A1", "corrupt");
    await service.earlyStop({
      ownerUserId: "owner-corrupt-export",
      reasonCode: "sufficient_evidence",
      reason: "先生成一份合法的部分终态。"
    });
    const stored = await store.findByOwnerAndVersion(
      "owner-corrupt-export",
      GI088_EVALUATION_VERSION
    );
    expect(stored).not.toBeNull();
    const state = structuredClone(stored!.state);
    state.tasks[1]!.branches.high.technicalError = "POST_TERMINAL_RESIDUE";
    expect(await store.compareAndSet({
      id: stored!.id,
      expectedRevision: stored!.revision,
      status: stored!.status,
      state,
      sealedAt: stored!.sealedAt
    })).toBe(true);

    await expect(service.export("owner-corrupt-export"))
      .rejects.toThrow("GI088_BATCH_TERMINAL_STATE_MISMATCH");
  });

  it("历史评价缺少任务触发字段时只读投影为 legacy_unknown", async () => {
    const { provider } = validProvider();
    const store = new Gi088MemoryStore();
    const service = new Gi088EvaluationService({ store, getProvider: () => provider });
    await service.startOff({
      ownerUserId: "owner-legacy-review",
      taskId: "A1",
      initialUserMessage: "这是一条历史评价兼容测试。",
      clientTurnId: "legacy-review-off"
    });
    await service.endTrajectory({
      ownerUserId: "owner-legacy-review",
      taskId: "A1",
      branch: "off",
      feeling: "same",
      quality: "minor_issue",
      targetTrigger: "triggered",
      reason: "先写入新版评价。"
    });
    const stored = await store.findByOwnerAndVersion(
      "owner-legacy-review",
      GI088_EVALUATION_VERSION
    );
    expect(stored).not.toBeNull();
    const state = structuredClone(stored!.state);
    delete state.earlyStop;
    delete (state.tasks[0].branches.off.review as unknown as { targetTrigger?: string }).targetTrigger;
    expect(await store.compareAndSet({
      id: stored!.id,
      expectedRevision: stored!.revision,
      status: stored!.status,
      state,
      sealedAt: stored!.sealedAt
    })).toBe(true);

    const restored = await service.getSession("owner-legacy-review");
    expect(restored.activeTask?.branches.off.review?.targetTrigger).toBe("legacy_unknown");
    expect(restored.batch.targetCoverage).toMatchObject({
      triggeredTrajectoryCount: 0,
      reviewedTrajectoryCount: 1
    });
  });

  it("假 Provider 完整走通 2 项、4 条配对轨迹、封存与只读导出", async () => {
    const { provider } = validProvider();
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      getProvider: () => provider
    });
    for (const [index, task] of GI088_TASKS.entries()) {
      await completeTask(service, "owner-6", task.id, String(index + 1));
      const progress = await service.getSession("owner-6");
      expect(progress.activeTask).toBeNull();
      if (index < GI088_TASKS.length - 1) {
        expect(progress.tasks[index + 1].status).toBe("ready");
      }
      if (index === 0) {
        await expect(
          service.compare({
            ownerUserId: "owner-6",
            taskId: task.id,
            preference: "high_better",
            reason: "开启组的承接更自然。"
          })
        ).resolves.toMatchObject({ activeTask: null });
        await expect(
          service.compare({
            ownerUserId: "owner-6",
            taskId: task.id,
            preference: "off_better",
            reason: "试图覆盖已经保存的裁决。"
          })
        ).rejects.toThrow("GI088_COMPARISON_ALREADY_RECORDED");
      }
    }
    expect(provider.complete).toHaveBeenCalledTimes(4);
    const beforeSeal = await service.getSession("owner-6");
    expect(beforeSeal.batch.completedTaskCount).toBe(2);
    const sealed = await service.seal("owner-6");
    expect(sealed.batch.status).toBe("sealed");
    const exported = await service.export("owner-6");
    expect(exported.completion).toEqual({
      status: "sealed",
      terminalAt: sealed.batch.sealedAt,
      completedTaskIds: GI088_TASKS.map((task) => task.id),
      notRunTaskIds: []
    });
    expect(exported.batch.tasks).toHaveLength(2);
    expect(exported.batch.tasks.every((task) => task.status === "completed")).toBe(true);
    expect(
      exported.batch.tasks[0].branches.off.turns[0].calls[0].rawFinalOutput
    ).toBe(firstTurnOutput());
    expect(JSON.stringify(exported)).not.toContain("reasoning_content");
    expect(exported.evaluation.configs).toEqual(GI088_CONFIGS);
    await expect(
      service.startOff({
        ownerUserId: "owner-6",
        taskId: "A1",
        initialUserMessage: "封存后不应继续。",
        clientTurnId: "after-seal"
      })
    ).rejects.toThrow("GI088_BATCH_ALREADY_SEALED");
  });
});
