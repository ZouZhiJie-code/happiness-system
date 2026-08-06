import { describe, expect, it } from "vitest";

import { generativeTrajectoryEvaluationCases } from "@/features/interview/event-centered/generative-evaluation-catalog";
import {
  advanceGenerativeTrajectory,
  applyGenerativeArchitecturePairReviews,
  createArchitectureComparisonPair,
  createGenerativeTrajectoryCheckpoint,
  createGenerativeVisibleReplay,
  GENERATIVE_ARCHITECTURE_CHECKPOINT_RUNTIME_VERSION,
  GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG,
  generativeArchitectureExecutionOrder,
  generativeArchitecturePairFingerprint,
  generativePricingFingerprint,
  median,
  parseGenerativeArchitectureComparisonCheckpoint,
  summarizeArchitectureComparisonGate,
  summarizeGenerativeAttempts
} from "@/features/interview/event-centered/generative-evaluation-runtime";
import { createInitialEventCenteredDialogueState } from "@/features/interview/event-centered/dialogue-state";
import type { AIProvider } from "@/server/services/ai/ai-provider";

const pricing = {
  model: "deepseek-v4-flash",
  currency: "USD" as const,
  inputPerMillion: 0.14,
  cacheHitInputPerMillion: 0.0028,
  outputPerMillion: 0.28,
  sourceUrl: "https://api-docs.deepseek.com/quick_start/pricing",
  effectiveDate: "2026-07-29"
};

function queuedProvider(outputs: unknown[]): AIProvider {
  let index = 0;
  return {
    name: "evaluation-runtime-test",
    async complete() {
      const content = outputs[index++];
      if (!content) throw new Error("missing queued output");
      return {
        content: JSON.stringify(content),
        latencyMs: 25,
        provider: "evaluation-runtime-test",
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 20,
          totalTokens: 120,
          promptCacheHitTokens: 40,
          promptCacheMissTokens: 60
        }
      };
    }
  };
}

function deepAskTurn() {
  return {
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: "answered",
      factDeltas: [{
        statement: "昨晚每个声音都会让用户立刻醒过来",
        scope: "current_event",
        stance: "affirmed",
        kind: "inner_experience",
        quote: "昨晚每个声音都让我立刻醒过来"
      }],
      correctionOrBoundary: null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action: "ask",
      activeAngle: "feeling",
      outcomeAssessment: {
        state: "needs_more",
        basis: "独居期待与陌生声音警觉同时出现，具体触发声音仍待说明",
        supportEvidenceRefs: ["new:1"],
        missingUnderstanding: "最先触发警觉的具体声音"
      },
      evidenceRefs: ["new:1"],
      insightKind: null,
      selectedTargetId: "specific_sound",
      expectedUnderstandingDelta: "找到让警觉升高的具体声音",
      tentativeInterpretation: null,
      stopReason: null,
      cognitiveAction: "anchor_specific",
      microgoalDelta: {
        operation: "start",
        statement: "看清陌生声音与警觉的变化",
        supportEvidenceRefs: ["new:1"]
      },
      realizationContract: {
        responseCore: "哪一种声音最先让你立刻醒过来",
        summaryAnchors: ["昨晚每个声音都会让用户立刻醒过来"]
      }
    },
    visibleTurn: {
      thinkingSummary: "当前矛盾在于期待与警觉同时存在。厘清警觉升高前后的变化，才能继续理解这份体验。",
      responseKind: "question",
      question: "昨晚哪一种声音最先让你立刻醒过来？",
      insight: null,
      honestLimit: null
    },
    decision: {
      turnAction: "ask",
      cognitiveAction: "anchor_specific",
      selectedTarget: "specific_sound",
      evidenceRefs: ["new:1"],
      microgoalDelta: {
        operation: "start",
        statement: "看清陌生声音与警觉的变化",
        supportEvidenceRefs: ["new:1"]
      },
      expectedValue: "找到让警觉升高的具体声音",
      stopReason: null,
      outcomeCandidate: null
    },
    reply: {
      naturalUnderstanding: "当前矛盾在于期待与警觉同时存在。厘清警觉升高前后的变化，才能继续理解这份体验。",
      question: "昨晚哪一种声音最先让你立刻醒过来？"
    }
  };
}

function deepPauseTurn() {
  return {
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: "answered",
      factDeltas: [{
        statement: "听见电梯声时用户会立刻醒来",
        scope: "current_event",
        stance: "affirmed",
        kind: "inner_experience",
        quote: "听见电梯声时"
      }],
      correctionOrBoundary: null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action: "pause",
      activeAngle: "feeling",
      outcomeAssessment: {
        state: "ready",
        origin: "user_articulated",
        basis: "电梯声与立刻醒来的警觉变化已经形成连接",
        supportEvidenceRefs: ["new:1"],
        missingUnderstanding: null
      },
      evidenceRefs: ["new:1"],
      insightKind: "connection",
      selectedTargetId: null,
      expectedUnderstandingDelta: "电梯声是这份警觉最明确的触发点",
      tentativeInterpretation: null,
      stopReason: "微目标已经形成清楚进展",
      cognitiveAction: null,
      microgoalDelta: {
        operation: "complete",
        statement: "看清陌生声音与警觉的变化",
        supportEvidenceRefs: ["new:1"]
      },
      realizationContract: {
        responseCore: "听见电梯声时会立刻醒来",
        summaryAnchors: ["电梯声", "立刻醒来"]
      }
    },
    visibleTurn: {
      thinkingSummary: null,
      responseKind: "pause",
      question: null,
      insight: "听见电梯声时会立刻醒来。",
      honestLimit: null
    },
    decision: {
      turnAction: "pause",
      cognitiveAction: null,
      selectedTarget: null,
      evidenceRefs: ["new:1"],
      microgoalDelta: {
        operation: "complete",
        statement: "看清陌生声音与警觉的变化",
        supportEvidenceRefs: ["new:1"]
      },
      expectedValue: null,
      stopReason: "微目标已经形成清楚进展",
      outcomeCandidate: null
    },
    reply: {
      naturalUnderstanding: "",
      question: null
    }
  };
}

function architectureOption(label: string, tokenUsageComplete = true) {
  const replay = createGenerativeVisibleReplay({
    payload: {
      naturalUnderstanding: `看见了${label}的联系。`,
      naturalResponse: `${label}最像什么？`,
      responseKind: "question",
      questionSpec: null,
      checkpoint: null,
      angleOutcome: null
    }
  });
  return {
    visibleReplay: replay,
    visibleResponse: `${label}可见回应`,
    technicalComplete: true,
    runtimeError: null,
    validationIssues: [],
    qualityDiagnostics: [],
    metrics: {
      latencyMs: 10,
      attempts: 1,
      tokenUsage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        promptCacheHitTokens: 0,
        promptCacheMissTokens: 10
      },
      tokenUsageComplete,
      estimatedCost: tokenUsageComplete ? 0.01 : null
    }
  };
}

describe("event-centered generative evaluation runtime", () => {
  it("MVP 评测继续固定使用 deepseek-v4-flash", () => {
    expect(GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG.model).toBe(
      "deepseek-v4-flash"
    );
  });

  it("汇总缓存与非缓存 token，并按冻结价格计算成本", () => {
    const metrics = summarizeGenerativeAttempts([{
      stage: "question",
      attempt: 1,
      provider: "test",
      success: true,
      latencyMs: 80,
      errorCode: null,
      tokenUsage: {
        promptTokens: 100,
        completionTokens: 20,
        totalTokens: 120,
        promptCacheHitTokens: 40,
        promptCacheMissTokens: 60
      }
    }], {
      model: "deepseek-v4-flash",
      currency: "CNY",
      inputPerMillion: 2,
      cacheHitInputPerMillion: 0.4,
      outputPerMillion: 8,
      sourceUrl: "https://example.com/pricing",
      effectiveDate: "2026-07-28"
    });

    expect(metrics).toMatchObject({
      latencyMs: 80,
      attempts: 1,
      tokenUsage: {
        promptTokens: 100,
        completionTokens: 20,
        promptCacheHitTokens: 40,
        promptCacheMissTokens: 60
      }
    });
    expect(metrics.estimatedCost).toBeCloseTo(0.000296);
  });

  it("供应商缺少 token usage 时成本保持未知，证据门不会按零成本通过", () => {
    const metrics = summarizeGenerativeAttempts([{
      stage: "question",
      attempt: 1,
      provider: "test",
      success: true,
      latencyMs: 80,
      errorCode: null,
      tokenUsage: null
    }], pricing);

    expect(metrics).toMatchObject({
      tokenUsageComplete: false,
      estimatedCost: null,
      tokenUsage: { totalTokens: 0 }
    });
  });

  it("轨迹逐轮保存事实、微目标和停止状态", async () => {
    const evaluationCase = generativeTrajectoryEvaluationCases.find((item) => item.caseId === "T02")!;
    const provider = queuedProvider([deepAskTurn(), deepPauseTurn()]);
    const first = await advanceGenerativeTrajectory({ evaluationCase, provider });

    expect(first.awaitingReply).toBe(true);
    expect(first.turns[0]).toMatchObject({
      finalAction: "ask",
      selectedTarget: "specific_sound",
      technicalComplete: true,
      visibleReplay: {
        thinkingSummary: "当前矛盾在于期待与警觉同时存在。厘清警觉升高前后的变化，才能继续理解这份体验。",
        userResponse: "昨晚哪一种声音最先让你立刻醒过来？"
      }
    });
    expect(first.facts[0]?.id).toBe("T02-fact-1");
    expect(first.state.currentMicrogoal).toMatchObject({ questionCount: 1, status: "active" });

    const second = await advanceGenerativeTrajectory({
      evaluationCase,
      checkpoint: first,
      reply: "听见电梯声时我会立刻醒来。",
      provider
    });
    expect(second.completed).toBe(true);
    expect(second.completionReason).toBe("微目标已经形成清楚进展");
    expect(second.turns).toHaveLength(2);
    expect(second.state.currentMicrogoal?.status).toBe("completed");
    expect(second.facts.map((fact) => fact.id)).toEqual(["T02-fact-1", "T02-fact-2"]);
  });

  it("真实可见投影让停止轮只出现一次成果，并呈现轻提示和角度入口", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "checkpoint_two";
    const replay = createGenerativeVisibleReplay({
      state,
      payload: {
        naturalUnderstanding: "",
        naturalResponse: "这一段先放在这里。",
        responseKind: "checkpoint",
        questionSpec: null,
        checkpoint: { kind: "second", outcome: "身体的结束晚于事情的结束。" },
        angleOutcome: {
          angle: "feeling",
          kind: "insight",
          statement: "身体的结束晚于事情的结束。"
        }
      }
    });

    expect(replay).toMatchObject({
      thinkingSummary: null,
      userResponse: "这一段先放在这里。",
      transitionHint: "这一段先到这里。继续输入会沿刚才的方向深入。",
      angleChoices: ["感受", "想法", "关系", "行动"]
    });
    expect(replay?.availableActions).not.toContain("continue_exploration");
  });

  it("架构盲评顺序稳定随机化，人工未裁决时保持阻断", () => {
    const option = architectureOption("同一个");
    const first = createArchitectureComparisonPair({
      caseId: "AB-FG-01",
      runIndex: 1,
      evaluationPayloadHash: "same-payload",
      oneCall: option,
      twoCall: option,
      seed: "stable-seed"
    });
    const second = createArchitectureComparisonPair({
      caseId: "AB-FG-01",
      runIndex: 1,
      evaluationPayloadHash: "same-payload",
      oneCall: option,
      twoCall: option,
      seed: "stable-seed"
    });

    expect(first.hiddenOrder).toEqual(second.hiddenOrder);
    expect(first.pairFingerprint).toBe(generativeArchitecturePairFingerprint(first));
    expect(first.optionA.visibleReplay).toEqual(first.optionB.visibleReplay);
    expect(summarizeArchitectureComparisonGate([first])).toMatchObject({
      blockedByPendingHumanReview: true,
      oneCall: { technicalComplete: 1, gateState: "blocked_pending_review" },
      twoCall: { technicalComplete: 1, gateState: "blocked_pending_review" }
    });
  });

  it("16 个正式 pair 的盲序位置与首发顺序分别保持 8/8", () => {
    const caseIds = ["AB-FG-01", "AB-FD-01", "AB-TG-01", "AB-TD-01", "AB-RG-01", "AB-RD-01", "AB-AG-01", "AB-AD-01"];
    const pairs = caseIds.flatMap((caseId) => [1, 2].map((runIndex) =>
      createArchitectureComparisonPair({
        caseId,
        runIndex,
        evaluationPayloadHash: "a".repeat(64),
        oneCall: architectureOption("一次调用"),
        twoCall: architectureOption("两次调用"),
        seed: "balanced-seed"
      })
    ));
    const displayOneCallFirst = pairs.filter((pair) => pair.hiddenOrder.A === "one_call").length;
    const executionOneCallFirst = caseIds.flatMap((caseId) => [1, 2].map((runIndex) =>
      generativeArchitectureExecutionOrder({ seed: "balanced-seed", caseId, runIndex })[0]
    )).filter((architecture) => architecture === "one_call").length;

    expect(displayOneCallFirst).toBe(8);
    expect(executionOneCallFirst).toBe(8);
    expect(pairs[0]?.pairFingerprint).not.toBe(generativeArchitecturePairFingerprint({
      ...pairs[0]!,
      optionA: pairs[0]!.optionB,
      optionB: pairs[0]!.optionA
    }));
  });

  it("checkpoint v4 绑定配置、价格、完整 pair 集、payload 与内容指纹", () => {
    const payloadHash = "b".repeat(64);
    const candidateVersions = {
      strategy: "strategy-v2",
      angleCard: "angle-v2",
      fewShot: "few-shot-v2"
    };
    const pairs = [1, 2].map((runIndex) => createArchitectureComparisonPair({
      caseId: "AB-FG-01",
      runIndex,
      evaluationPayloadHash: payloadHash,
      oneCall: architectureOption(`一次-${runIndex}`),
      twoCall: architectureOption(`两次-${runIndex}`),
      seed: "checkpoint-seed"
    }));
    const checkpoint = {
      runtimeVersion: GENERATIVE_ARCHITECTURE_CHECKPOINT_RUNTIME_VERSION,
      datasetVersion: "2026-07-29.v2",
      seed: "checkpoint-seed",
      caseIds: ["AB-FG-01"],
      repetitions: 2 as const,
      runtimeConfig: GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG,
      pricingSnapshot: pricing,
      pricingFingerprint: generativePricingFingerprint(pricing),
      candidateVersions,
      pairs,
      completed: true,
      updatedAt: "2026-07-29T12:00:00.000Z"
    };
    const expected = {
      datasetVersion: checkpoint.datasetVersion,
      seed: checkpoint.seed,
      caseIds: checkpoint.caseIds,
      candidateVersions,
      pricing,
      evaluationPayloadHashes: { "AB-FG-01": payloadHash }
    };

    expect(parseGenerativeArchitectureComparisonCheckpoint(checkpoint, expected).completed).toBe(true);

    const mutations = [
      (value: typeof checkpoint) => { value.completed = false; },
      (value: typeof checkpoint) => { value.pairs[1] = structuredClone(value.pairs[0]!); },
      (value: typeof checkpoint) => { value.pairs[0]!.evaluationPayloadHash = "c".repeat(64); },
      (value: typeof checkpoint) => { value.pairs[0]!.pairFingerprint = "d".repeat(64); },
      (value: typeof checkpoint) => { value.pricingSnapshot.outputPerMillion = 0.29; },
      (value: typeof checkpoint) => { value.pairs[0]!.productPreference = "A"; },
      (value: typeof checkpoint) => {
        value.runtimeConfig = { ...value.runtimeConfig, maxTokens: 1499 as 1500 };
      }
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(checkpoint);
      mutate(changed);
      expect(() => parseGenerativeArchitectureComparisonCheckpoint(changed, expected)).toThrow();
    }
    expect(() => parseGenerativeArchitectureComparisonCheckpoint(checkpoint, {
      ...expected,
      pricing: { ...pricing, outputPerMillion: 0.29 }
    })).toThrow("ARCHITECTURE_COMPARISON_CHECKPOINT_MISMATCH");
  });

  it("人工评审严格绑定 pair 指纹和 A/B 顺序，偏好只接受四个枚举值", () => {
    const payloadHash = "e".repeat(64);
    const pair = createArchitectureComparisonPair({
      caseId: "AB-FG-01",
      runIndex: 1,
      evaluationPayloadHash: payloadHash,
      oneCall: architectureOption("一次"),
      twoCall: architectureOption("两次"),
      seed: "review-seed"
    });
    const checkpoint = {
      runtimeVersion: GENERATIVE_ARCHITECTURE_CHECKPOINT_RUNTIME_VERSION,
      datasetVersion: "2026-07-29.v2",
      seed: "review-seed",
      caseIds: ["AB-FG-01"],
      repetitions: 2 as const,
      runtimeConfig: GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG,
      pricingSnapshot: pricing,
      pricingFingerprint: generativePricingFingerprint(pricing),
      candidateVersions: { strategy: "s", angleCard: "a", fewShot: "f" },
      pairs: [pair],
      completed: false,
      updatedAt: "2026-07-29T12:00:00.000Z"
    };
    const passReview = {
      initialVerdict: "pass" as const,
      initialReviewedBy: "codex" as const,
      initialReviewedAt: "2026-07-29T12:30:00.000Z",
      primaryReason: null,
      secondaryReason: null,
      visibleEvidence: "认识有增量",
      finalVerdict: "pass" as const,
      rootCause: null,
      resolution: null,
      reviewedBy: "product_owner" as const,
      reviewedAt: "2026-07-29T13:00:00.000Z"
    };
    const review = {
      pairId: pair.pairId,
      pairFingerprint: pair.pairFingerprint,
      optionAReview: passReview,
      optionBReview: passReview,
      preference: "tie" as const,
      reason: "两边体验相当"
    };

    const initialOnlyReview = {
      ...passReview,
      finalVerdict: null,
      reviewedBy: null,
      reviewedAt: null
    };
    const initialReviewed = applyGenerativeArchitecturePairReviews(checkpoint, [{
      pairId: pair.pairId,
      pairFingerprint: pair.pairFingerprint,
      optionAReview: initialOnlyReview,
      optionBReview: initialOnlyReview,
      initialPreference: "tie",
      initialReason: "Codex 初评认为两边体验相当",
      preference: null,
      reason: null
    }]);
    expect(initialReviewed.pairs[0]).toMatchObject({
      initialPreference: "tie",
      initialPreferenceReason: "Codex 初评认为两边体验相当",
      productPreference: null,
      productReason: null
    });

    const reviewed = applyGenerativeArchitecturePairReviews(checkpoint, [review]);
    expect(reviewed.pairs[0]).toMatchObject({
      productPreference: "tie",
      productReason: "两边体验相当"
    });
    expect(() => applyGenerativeArchitecturePairReviews(checkpoint, [{
      ...review,
      pairFingerprint: "f".repeat(64)
    }])).toThrow("ARCHITECTURE_COMPARISON_REVIEW_FINGERPRINT_MISMATCH");
    expect(() => applyGenerativeArchitecturePairReviews(checkpoint, [{
      ...review,
      preference: "one_call"
    }])).toThrow("ARCHITECTURE_COMPARISON_REVIEW_INVALID");
  });

  it("token 证据缺失会让架构技术证据门失败", () => {
    const pair = createArchitectureComparisonPair({
      caseId: "AB-FG-01",
      runIndex: 1,
      evaluationPayloadHash: "a".repeat(64),
      oneCall: architectureOption("一次", true),
      twoCall: architectureOption("两次", false),
      seed: "usage-seed"
    });

    expect(summarizeArchitectureComparisonGate([pair])).toMatchObject({
      oneCall: { technicalComplete: 1 },
      twoCall: { technicalComplete: 0, gateState: "fail" }
    });
  });

  it("轨迹 checkpoint 可以在调用前建立，且中位数支持奇偶样本", () => {
    const evaluationCase = generativeTrajectoryEvaluationCases.find((item) => item.caseId === "T07")!;
    const checkpoint = createGenerativeTrajectoryCheckpoint(evaluationCase);
    expect(checkpoint).toMatchObject({
      caseId: "T07",
      split: "work",
      completed: false,
      awaitingReply: false
    });
    expect(median([8, 2, 5])).toBe(5);
    expect(median([8, 2, 6, 4])).toBe(5);
  });
});
