import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type {
  AICompletionParams,
  AICompletionResult,
  AIProvider
} from "@/server/services/ai/ai-provider";
import {
  createGi088CanonicalInterviewStateV2Initial,
  projectGi088CanonicalV2ToBoard7bV1State
} from "@/server/services/evaluation/gi088/canonical-interview-state-v2";
import { GI088_V8R3_DEVELOPMENT_CASES } from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import {
  GI088_PRO_CONTRACT_DEVELOPMENT_CALLS_MAXIMUM,
  GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_CASE_IDS,
  GI088_PRO_CONTRACT_TOTAL_CALLS_MAXIMUM,
  createGi088ProContractCompletionParams,
  createGi088ContractNeutralSkill,
  createGi088ProContractDevelopmentSchedule,
  createGi088ProContractGroupDefinition,
  createGi088ProContractCommonProductPrompt,
  createGi088ExecutableCompactSystemPrompt,
  createGi088FullContractSystemPrompt,
  decideGi088ProContractControl
} from "../../evals/event-centered-generative/gi088-pro-contract-projection-ab/contracts";
import {
  acquireGi088ProContractExecutionReservation,
  createGi088ProContractDevelopmentReviewSource,
  evaluateGi088ProContractDevelopmentDecision,
  executeGi088ProContractDevelopment,
  readGi088ProContractPrivateReport,
  writeGi088ProContractDevelopmentArtifacts,
  type Gi088ProContractDevelopmentHumanSummary
} from "../../evals/event-centered-generative/gi088-pro-contract-projection-ab/runner";
import { createGi088CanonicalV2StateAdapter } from "../../evals/event-centered-generative/gi088-pro-contract-projection-ab/state-adapter";
import {
  assertGi088ProContractAuthorization,
  validateGi088ProContractEnvironment
} from "../../scripts/run-gi088-pro-contract-projection-ab";

const FINGERPRINTS = {
  candidateFingerprint: "a".repeat(64),
  datasetFingerprint: "b".repeat(64),
  runnerFingerprint: "c".repeat(64),
  experienceFingerprint: "d".repeat(64),
  executionFingerprint: "e".repeat(64)
};

const TOOL_SOURCE = {
  version: "2026-08-12.gi088-pro-contract-tool-source-v1",
  fileCount: 6,
  aggregateSha256: "f".repeat(64),
  files: ["contracts.ts", "runner.ts", "state-adapter.ts", "cli.ts", "canonical.ts", "review.ts"]
    .map((path, index) => ({ path, sha256: String(index).repeat(64) }))
} as const;

const checkpointByLatestUser = new Map(
  GI088_V8R3_DEVELOPMENT_CASES.flatMap((evaluationCase) =>
    evaluationCase.checkpoints.map((checkpoint) => [
      checkpoint.afterUserMessageId,
      checkpoint
    ] as const)
  )
);

type ModelInput = {
  latestUserMessageId: string;
  conversation: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  canonicalState: ReturnType<typeof createGi088CanonicalInterviewStateV2Initial>;
  fullContractCompatibilityView?: unknown;
};

function parseModelInput(params: AICompletionParams): ModelInput {
  return JSON.parse(params.messages.at(-1)!.content) as ModelInput;
}

function diagnostics(latencyMs = 100) {
  return {
    finishReason: "stop" as const,
    reasoningPresent: true,
    reasoningLength: 30,
    reasoningTokens: 10,
    latencyMs,
    tokenUsage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
    upstreamRequestId: "private-upstream-request-id",
    httpStatus: 200,
    responseModel: "deepseek-v4-pro",
    choiceCount: 1,
    contentType: "object" as const,
    contentLength: 300,
    reasoningType: "string" as const,
    headersLatencyMs: 10,
    bodyLatencyMs: latencyMs - 10,
    totalLatencyMs: latencyMs,
    timeoutStage: null,
    abortSource: null
  };
}

function completionFor(params: AICompletionParams): AICompletionResult {
  const input = parseModelInput(params);
  const checkpoint = checkpointByLatestUser.get(input.latestUserMessageId);
  if (!checkpoint) throw new Error(`unknown checkpoint: ${input.latestUserMessageId}`);
  const action = checkpoint.allowedActions.find((item) => item !== "pause") ?? "pause";
  const userIds = input.conversation
    .filter((message) => message.role === "user")
    .map((message) => message.id);
  const activeTask = input.canonicalState.tasks.find(
    (task) => task.taskRef === input.canonicalState.activeTaskRef
  )!;
  const isFull = params.messages[0]!.content.includes("semantic-delta v2.4");
  const marker = isFull ? "完整合同" : "精简合同";
  const ask = action === "ask";
  const response = ask
    ? `${marker}：你愿意补充一个能推进当前重点的具体线索吗？比如当时最明显的感受是什么？`
    : `${marker}：我先把你刚才确认的重点整理在这里。`;
  const content = isFull
    ? {
        semantic: {
          stage: activeTask.stage,
          action,
          workingTask: {
            continuity: "continue",
            targetRef: activeTask.taskRef,
            summary: activeTask.summary,
            evidenceRefs: [input.latestUserMessageId]
          },
          understandingChange: {
            kind: "add",
            summary: `基于 ${input.latestUserMessageId} 的新增认识`,
            evidenceRefs: userIds
          },
          invalidatedRefs: [],
          returnableTaskDelta: { preserveRefs: [], add: [] },
          nextInquiry: ask
            ? {
                answerTarget: "补充一个推进当前共同任务的具体线索",
                taskEffect: "用新线索更新当前认识",
                evidenceRefs: [input.latestUserMessageId]
              }
            : null,
          answerOpportunity: ask ? "new" : null,
          burdenSignalChange: { kind: "unchanged" },
          pauseReason: null
        },
        visible: {
          understanding: `我会继续围绕 ${activeTask.summary}。`,
          response
        }
      }
    : {
        taskDecision: {
          kind: "continue",
          targetRef: activeTask.taskRef,
          summary: null,
          evidenceRefs: [input.latestUserMessageId]
        },
        deferredTasks: [],
        understandingDecision: {
          kind: "add",
          summary: `基于 ${input.latestUserMessageId} 的新增认识`,
          evidenceRefs: userIds
        },
        progressionDecision: "hold",
        responseAct: action,
        inquiry: ask
          ? {
              answerTarget: "补充一个推进当前共同任务的具体线索",
              expectedUpdate: "用新线索更新当前认识",
              evidenceRefs: [input.latestUserMessageId]
            }
          : null,
        burdenDecision: { kind: "unchanged" },
        visible: {
          understanding: `我会继续围绕 ${activeTask.summary}。`,
          response
        }
      };
  return {
    content: JSON.stringify(content),
    latencyMs: 100,
    provider: "openai",
    tokenUsage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
    diagnostics: diagnostics()
  };
}

function provider(input?: {
  failFullFirstD25Attempt?: boolean;
  seen?: AICompletionParams[];
}): AIProvider {
  let failed = false;
  return {
    name: "openai",
    async complete(params) {
      input?.seen?.push(params);
      const modelInput = parseModelInput(params);
      const isFull = params.messages[0]!.content.includes("returnableTaskDelta");
      if (
        input?.failFullFirstD25Attempt &&
        !failed &&
        isFull &&
        modelInput.latestUserMessageId === "gi088-v8r3-d25-m3"
      ) {
        failed = true;
        throw new Error("provider test failure");
      }
      return completionFor(params);
    }
  };
}

function humanSummary(overrides?: Partial<Gi088ProContractDevelopmentHumanSummary>) {
  return {
    groups: {
      full: { directUseCount: 14, minorIssueCount: 2, qualityFailureCount: 0, blockerCount: 0 },
      compact: { directUseCount: 14, minorIssueCount: 2, qualityFailureCount: 0, blockerCount: 0 }
    },
    compactPairWinCount: 8,
    fullPairWinCount: 8,
    tieCount: 0,
    ...overrides
  } satisfies Gi088ProContractDevelopmentHumanSummary;
}

describe("GI-088 DeepSeek Pro 完整合同与可执行精简合同配对验证", () => {
  it("固定 28 个开发案例、32 checkpoints 和 64 份每组结果", () => {
    const first = createGi088ProContractDevelopmentSchedule(
      GI088_V8R3_DEVELOPMENT_CASES
    );
    const second = createGi088ProContractDevelopmentSchedule(
      [...GI088_V8R3_DEVELOPMENT_CASES].reverse()
    );
    expect(first).toEqual(second);
    expect(first.schedule).toHaveLength(56);
    expect(new Set(first.schedule.map((item) => `${item.caseId}:${item.attempt}`)).size)
      .toBe(56);
    expect(GI088_PRO_CONTRACT_DEVELOPMENT_CALLS_MAXIMUM).toBe(128);
    expect(GI088_PRO_CONTRACT_TOTAL_CALLS_MAXIMUM).toBe(160);
    expect(GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_CASE_IDS).toHaveLength(8);
  });

  it("两组共享同一 canonical v2 事实，只改变输出合同和投影器", () => {
    const state = createGi088CanonicalInterviewStateV2Initial({
      workingTask: {
        summary: "理解当前疲惫",
        evidenceRefs: ["u1"],
        stage: "explore_clarify"
      }
    });
    const conversation = [
      { id: "u1", role: "user" as const, content: "今天很累。" },
      { id: "a1", role: "assistant" as const, content: "你想从哪里说起？" },
      { id: "u2", role: "user" as const, content: "先说工作。" }
    ];
    const fullTurnInput = {
      mode: "accompany_chat" as const,
      conversation,
      latestUserMessageId: "u2",
      semanticState: projectGi088CanonicalV2ToBoard7bV1State(state)
    };
    const controlDecision = decideGi088ProContractControl({
      canonicalState: state,
      conversation
    }).decision;
    const full = createGi088ProContractCompletionParams({
      group: "full",
      canonicalState: state,
      conversation,
      latestUserMessageId: "u2",
      fullTurnInput,
      controlDecision
    });
    const compact = createGi088ProContractCompletionParams({
      group: "compact",
      canonicalState: state,
      conversation,
      latestUserMessageId: "u2",
      fullTurnInput,
      controlDecision
    });
    const fullInput = parseModelInput(full);
    const compactInput = parseModelInput(compact);
    expect(fullInput.canonicalState).toEqual(compactInput.canonicalState);
    expect(fullInput.conversation).toEqual(compactInput.conversation);
    expect(fullInput.latestUserMessageId).toBe(compactInput.latestUserMessageId);
    expect(full.messages.at(-1)?.content).toBe(compact.messages.at(-1)?.content);
    expect(full.messages[1]).toEqual(compact.messages[1]);
    expect(fullInput.fullContractCompatibilityView).toBeDefined();
    expect(compactInput.fullContractCompatibilityView).toBeDefined();
    expect(createGi088ProContractGroupDefinition("full").identity)
      .toEqual(createGi088ProContractGroupDefinition("compact").identity);
    expect(createGi088ProContractGroupDefinition("full").contractVersion)
      .not.toBe(createGi088ProContractGroupDefinition("compact").contractVersion);
    expect(createGi088ContractNeutralSkill()).toContain("## 三个微案例");
    expect(createGi088ContractNeutralSkill()).toContain("保持共同任务");
    expect(createGi088ExecutableCompactSystemPrompt()).not.toContain("returnableTaskDelta");
    expect(createGi088ExecutableCompactSystemPrompt()).not.toContain("semantic.workingTask");
    expect(createGi088ExecutableCompactSystemPrompt()).not.toContain("semanticContext");
    expect(createGi088ExecutableCompactSystemPrompt()).not.toContain("understandingChange");
    expect(createGi088ExecutableCompactSystemPrompt()).toContain("缺乏证据时猜测第三方动机");
    expect(createGi088FullContractSystemPrompt()).toContain("returnableTaskDelta");
    const commonPrompt = createGi088ProContractCommonProductPrompt();
    expect(createGi088FullContractSystemPrompt().startsWith(commonPrompt)).toBe(true);
    expect(createGi088ExecutableCompactSystemPrompt().startsWith(commonPrompt)).toBe(true);
    for (const params of [full, compact]) {
      expect(params).toMatchObject({
        useProviderDefaultMaxTokens: true,
        responseFormat: "json_object",
        thinking: "enabled",
        reasoningEffort: "high",
        headersTimeoutMs: 60_000,
        bodyIdleTimeoutMs: 60_000,
        hardTimeoutMs: 60_000
      });
      expect(params.maxTokens).toBeUndefined();
    }
  });

  it("停止控制只读取用户原话，并区分纯停止、混合停止和否定引用", () => {
    const state = createGi088CanonicalInterviewStateV2Initial({
      workingTask: { summary: "继续理解当下感受", evidenceRefs: ["u0"] }
    });
    const control = (content: string) => decideGi088ProContractControl({
      canonicalState: state,
      conversation: [{ id: "u1", role: "user" as const, content }]
    });
    expect(control("今天先到这。 ").explicitStop).toBe("pure");
    const mixed = control("回答这些问题让我有点累，这就是我今天想补充的，先到这。 ");
    expect(mixed.explicitStop).toBe("mixed");
    expect(mixed.decision.contentEvidenceText).toContain("回答这些问题");
    expect(control("我没说要先到这，我还想继续聊。 ").explicitStop).toBe("none");
  });

  it("完成 128 份对称结果并在轨迹第二轮继承各侧真实状态与回复", async () => {
    const report = await executeGi088ProContractDevelopment({
      cases: GI088_V8R3_DEVELOPMENT_CASES,
      provider: provider(),
      adapter: createGi088CanonicalV2StateAdapter(),
      globalFingerprintBundleBefore: FINGERPRINTS,
      readGlobalFingerprintBundleAfter: () => FINGERPRINTS,
      toolSourceFingerprint: TOOL_SOURCE,
      now: () => new Date("2026-08-12T12:00:00.000Z")
    });
    expect(report.records).toHaveLength(128);
    expect(report.budget).toEqual({
      developmentMaximum: 128,
      providerCalls: 128,
      recoveries: 0,
      retries: 0,
      judgeCalls: 0
    });
    expect(report.technicalSummaries.map((item) => item.firstValidCount))
      .toEqual([64, 64]);
    expect(report.technicalGates.every((gate) => gate.passed)).toBe(true);
    expect(report.records.some(
      (record) => record.questionObservation.reviewCandidate === "multiple_question_marks"
    )).toBe(true);
    expect(report.globalRuntimeFingerprintsUnchanged).toBe(true);

    const trajectory = report.records.filter(
      (record) =>
        record.caseId === "GI088-V8R3-D25" &&
        record.attempt === 1 &&
        record.checkpointIndex === 1
    );
    expect(trajectory).toHaveLength(2);
    const fullConversation = trajectory.find((item) => item.group === "full")!
      .visibleConversation;
    const compactConversation = trajectory.find((item) => item.group === "compact")!
      .visibleConversation;
    expect(fullConversation.some(
      (message) => message.role === "assistant" && message.content.includes("完整合同")
    )).toBe(true);
    expect(compactConversation.some(
      (message) => message.role === "assistant" && message.content.includes("精简合同")
    )).toBe(true);
    expect(trajectory[0]!.semanticInputHash).not.toBe(trajectory[1]!.semanticInputHash);
    const source = createGi088ProContractDevelopmentReviewSource(report);
    expect(source.cards).toHaveLength(16);
    const trajectoryCard = source.cards.find(
      (card) => card.caseId === "GI088-V8R3-D25" && card.attempt === 1
    )!;
    expect(trajectoryCard.left.messages).not.toEqual(trajectoryCard.right.messages);
  }, 30_000);

  it("混合停止两侧各调用一次并以单一 revision 原子吸收内容和暂停", async () => {
    const cases = structuredClone(GI088_V8R3_DEVELOPMENT_CASES);
    const target = cases.find((item) => item.id === "GI088-V8R3-D01")!;
    const latestId = target.checkpoints[0]!.afterUserMessageId;
    target.messages.find((message) => message.id === latestId)!.content =
      "回答这些问题让我有点累，这就是我今天想补充的，先到这。";
    const seen: AICompletionParams[] = [];
    const report = await executeGi088ProContractDevelopment({
      cases,
      provider: provider({ seen }),
      adapter: createGi088CanonicalV2StateAdapter(),
      globalFingerprintBundleBefore: FINGERPRINTS,
      readGlobalFingerprintBundleAfter: () => FINGERPRINTS,
      toolSourceFingerprint: TOOL_SOURCE,
      now: () => new Date("2026-08-12T12:00:00.000Z")
    });
    const mixed = report.records.filter((record) => record.caseId === target.id);
    expect(mixed).toHaveLength(4);
    for (const record of mixed) {
      expect(record).toMatchObject({
        providerCalled: true,
        programOwnedStop: true,
        effectiveValid: true,
        action: "pause"
      });
      expect(record.canonicalState?.sessionStatus).toBe("paused");
      expect(record.projectionReceipt?.outputRevision)
        .toBe((record.projectionReceipt?.inputRevision ?? -1) + 1);
      expect(record.projectionReceipt?.appliedActions)
        .toContain("mixed_stop_content_absorbed");
    }
    expect(seen).toHaveLength(128);
  }, 30_000);

  it("轨迹首轮技术失败后同侧第二轮记为 blocked 且不追加调用", async () => {
    const seen: AICompletionParams[] = [];
    const report = await executeGi088ProContractDevelopment({
      cases: GI088_V8R3_DEVELOPMENT_CASES,
      provider: provider({ failFullFirstD25Attempt: true, seen }),
      adapter: createGi088CanonicalV2StateAdapter(),
      globalFingerprintBundleBefore: FINGERPRINTS,
      readGlobalFingerprintBundleAfter: () => FINGERPRINTS,
      toolSourceFingerprint: TOOL_SOURCE,
      now: () => new Date("2026-08-12T12:00:00.000Z")
    });
    const failed = report.records.find(
      (record) =>
        record.caseId === "GI088-V8R3-D25" &&
        record.group === "full" &&
        record.checkpointIndex === 0 &&
        !record.effectiveValid
    );
    expect(failed).toBeDefined();
    const blocked = report.records.find(
      (record) =>
        record.caseId === "GI088-V8R3-D25" &&
        record.attempt === failed!.attempt &&
        record.group === "full" &&
        record.checkpointIndex === 1
    );
    expect(blocked).toMatchObject({
      blockedByPriorFailure: true,
      providerCalled: false,
      effectiveValid: false,
      failureCategory: "state_commit",
      failureIssues: ["BLOCKED_BY_PRIOR_FAILURE"]
    });
    expect(seen).toHaveLength(127);
    expect(report.budget.providerCalls).toBe(127);
    expect(report.technicalSummaries.find((item) => item.group === "full"))
      .toMatchObject({ blockedByPriorFailureCount: 1, categorizedFailureCount: 2 });
  }, 30_000);

  it("实用等效时选择精简组，超出任一范围时选择完整组", async () => {
    const report = await executeGi088ProContractDevelopment({
      cases: GI088_V8R3_DEVELOPMENT_CASES,
      provider: provider(),
      adapter: createGi088CanonicalV2StateAdapter(),
      globalFingerprintBundleBefore: FINGERPRINTS,
      readGlobalFingerprintBundleAfter: () => FINGERPRINTS,
      toolSourceFingerprint: TOOL_SOURCE,
      now: () => new Date("2026-08-12T12:00:00.000Z")
    });
    expect(evaluateGi088ProContractDevelopmentDecision({
      report,
      human: humanSummary()
    })).toMatchObject({
      status: "winner_selected",
      winner: "compact",
      reason: "compact_practical_equivalence"
    });
    expect(evaluateGi088ProContractDevelopmentDecision({
      report,
      human: humanSummary({
        groups: {
          full: { directUseCount: 15, minorIssueCount: 1, qualityFailureCount: 0, blockerCount: 0 },
          compact: { directUseCount: 14, minorIssueCount: 2, qualityFailureCount: 0, blockerCount: 0 }
        }
      })
    })).toMatchObject({
      winner: "full",
      reason: "compact_exceeded_equivalence_range"
    });
  }, 30_000);

  it("私有报告与盲评源原子写入 0600、禁止覆盖并校验完整性", async () => {
    const report = await executeGi088ProContractDevelopment({
      cases: GI088_V8R3_DEVELOPMENT_CASES,
      provider: provider(),
      adapter: createGi088CanonicalV2StateAdapter(),
      globalFingerprintBundleBefore: FINGERPRINTS,
      readGlobalFingerprintBundleAfter: () => FINGERPRINTS,
      toolSourceFingerprint: TOOL_SOURCE,
      now: () => new Date("2026-08-12T12:00:00.000Z")
    });
    const root = await mkdtemp(resolve(tmpdir(), "gi088-pro-contract-"));
    const reportPath = resolve(root, "development-report.json");
    const reviewSourcePath = resolve(root, "development-review.json");
    await writeGi088ProContractDevelopmentArtifacts({
      report,
      reportPath,
      reviewSourcePath
    });
    expect((await stat(reportPath)).mode & 0o077).toBe(0);
    expect((await stat(reviewSourcePath)).mode & 0o077).toBe(0);
    await expect(readGi088ProContractPrivateReport(reportPath))
      .resolves.toMatchObject({ reportFingerprint: report.reportFingerprint });
    const source = await readFile(reviewSourcePath, "utf8");
    expect(source).not.toContain("private-upstream-request-id");
    expect(source).not.toContain("reasoningLength");
    await expect(writeGi088ProContractDevelopmentArtifacts({
      report,
      reportPath,
      reviewSourcePath
    })).rejects.toThrow("GI088_PRO_CONTRACT_ARTIFACT_ALREADY_EXISTS");
  }, 30_000);

  it("Provider 身份、Production 和分阶段调用预算在执行前严格校验", () => {
    const valid = {
      NODE_ENV: "test",
      DEEPSEEK_API_KEY: "test-key",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com"
    } as NodeJS.ProcessEnv;
    expect(validateGi088ProContractEnvironment(valid)).toMatchObject({
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro"
    });
    expect(() => validateGi088ProContractEnvironment({
      ...valid,
      NODE_ENV: "production"
    })).toThrow("GI088_PRO_CONTRACT_PRODUCTION_FORBIDDEN");
    expect(() => validateGi088ProContractEnvironment({
      ...valid,
      DEEPSEEK_BASE_URL: "https://example.com"
    })).toThrow();
    expect(() => assertGi088ProContractAuthorization("development", {
      NODE_ENV: "test",
      GI088_PRO_CONTRACT_MODEL_CALLS: "I_UNDERSTAND_MODEL_CALLS",
      GI088_PRO_CONTRACT_MODEL_CALL_SCOPE: "development",
      GI088_PRO_CONTRACT_AUTHORIZED_CALL_BUDGET: "127"
    })).toThrow("GI088_PRO_CONTRACT_MODEL_CALL_AUTHORIZATION_REQUIRED");
    expect(() => assertGi088ProContractAuthorization("development", {
      NODE_ENV: "test",
      GI088_PRO_CONTRACT_MODEL_CALLS: "I_UNDERSTAND_MODEL_CALLS",
      GI088_PRO_CONTRACT_MODEL_CALL_SCOPE: "development",
      GI088_PRO_CONTRACT_AUTHORIZED_CALL_BUDGET: "128"
    })).not.toThrow();
  });

  it("阶段运行锁使用原子独占，两个并发执行只有一个能预留模型预算", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "gi088-pro-contract-lock-"));
    const lockPath = resolve(root, "development-execution.lock");
    const attempts = await Promise.allSettled([
      acquireGi088ProContractExecutionReservation({
        lockPath,
        stage: "development",
        targetPaths: [resolve(root, "report.json"), resolve(root, "source.json")],
        createdAt: "2026-08-12T12:00:00.000Z"
      }),
      acquireGi088ProContractExecutionReservation({
        lockPath,
        stage: "development",
        targetPaths: [resolve(root, "report.json"), resolve(root, "source.json")],
        createdAt: "2026-08-12T12:00:00.000Z"
      })
    ]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect((await stat(lockPath)).mode & 0o077).toBe(0);
  });
});
