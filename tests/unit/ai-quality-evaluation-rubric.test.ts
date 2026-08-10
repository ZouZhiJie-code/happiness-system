import {
  classifyEvaluation,
  evaluateGenerationTraceRules,
  mergeRuleAndJudgeScores,
  shouldTriggerJudge
} from "@/features/ai-quality/evaluation-rubric";

function buildTurn(overrides: Record<string, unknown> = {}) {
  return {
    insight: "",
    thinkingSummary: "我理解到你已经不想继续展开。",
    analysis: "内部分析",
    question: "",
    stateUpdate: {
      turnPhase: "choice",
      shouldEndDimension: false,
      offerChoice: true,
      choiceKind: "boundary_insufficient",
      choiceReason: "我不再继续追问细节了"
    },
    meta: { depthReached: ["event"] },
    ...overrides
  };
}

function buildTrace(overrides: Record<string, unknown> = {}) {
  return {
    id: "trace-1",
    status: "completed",
    artifactType: "interview_turn" as const,
    dimension: "joy" as const,
    outputOrigin: "deterministic",
    contextSnapshot: {
      userMessage: "先这样吧，不想继续了。",
      snapshot: {}
    },
    finalOutput: buildTurn(),
    pipelineDecisions: [],
    invocations: [],
    ...overrides
  };
}

describe("AI quality evaluation rubric", () => {
  it("accepts a low-pressure choice that respects an explicit stop boundary", () => {
    const result = evaluateGenerationTraceRules({ trace: buildTrace() });

    expect(result.score).toBe(100);
    expect(result.critical).toBe(false);
    expect(classifyEvaluation(result.score, result.critical)).toBe("good");
  });

  it("marks continued questioning after a stop boundary as a critical badcase", () => {
    const result = evaluateGenerationTraceRules({
      trace: buildTrace({
        outputOrigin: "llm",
        finalOutput: buildTurn({
          question: "你能再详细说说当时到底发生了什么吗？",
          stateUpdate: {
            turnPhase: "digging",
            shouldEndDimension: false,
            offerChoice: false,
            choiceReason: ""
          }
        })
      })
    });

    expect(result.critical).toBe(true);
    expect(result.deductions).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "boundary_critical_not_respected" })])
    );
    expect(classifyEvaluation(result.score, result.critical)).toBe("bad");
    expect(shouldTriggerJudge("trace-boundary", result)).toEqual({ trigger: true, reason: "risk" });
  });

  it("reuses persisted journal quality-gate issues in the structured report", () => {
    const result = evaluateGenerationTraceRules({
      trace: {
        ...buildTrace(),
        artifactType: "dimension_journal",
        dimension: "gratitude",
        outputOrigin: "fallback",
        finalOutput: {
          title: "被稳稳接住",
          content: "今天她帮我把散乱的事情理清，也认真问了我真正担心的部分，让我慢慢安定下来。"
        },
        pipelineDecisions: [
          {
            kind: "draft_quality_gate",
            accepted: false,
            issues: ["missing_supporting_scene_anchor"]
          }
        ]
      }
    });

    expect(result.signals).toContain("draft_quality_gate_rejected");
    expect(result.deductions).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "draft_gate_missing_supporting_scene_anchor" })])
    );
  });

  it("evaluates event journals from their frozen event source without applying a five-dimension gate", () => {
    const result = evaluateGenerationTraceRules({
      trace: {
        ...buildTrace(),
        artifactType: "event_journal",
        dimension: null,
        outputOrigin: "llm",
        contextSnapshot: {
          sourceSnapshot: {
            messages: [{ id: "message-1", role: "user", content: "今天开会时我终于把真正担心的事说清楚了。" }],
            facts: [{ id: "fact-1", statement: "用户在会上说清楚了真正担心的事。" }],
            angleOutcomes: []
          }
        },
        finalOutput: {
          title: "把担心说清楚",
          content: "今天开会时，我终于把真正担心的事说清楚了。说出口之后，我发现自己更在意的是彼此能不能坦诚面对分歧。"
        },
        pipelineDecisions: [{ kind: "event_journal_quality_gate", accepted: true, issues: [] }]
      }
    });

    expect(result.score).toBe(100);
    expect(result.signals).toContain("event_journal_quality_gate_passed");
    expect(result.deductions).toEqual([]);
  });

  it("reports event-boundary leakage through the event journal quality gate", () => {
    const result = evaluateGenerationTraceRules({
      trace: {
        ...buildTrace(),
        artifactType: "event_journal",
        dimension: null,
        contextSnapshot: { sourceMessageIds: ["message-1"] },
        finalOutput: {
          title: "把担心说清楚",
          content: "今天开会时，我终于把真正担心的事说清楚了。说出口之后，我也更确认自己希望怎样面对接下来的沟通。"
        },
        pipelineDecisions: [{ kind: "event_journal_quality_gate", accepted: false, issues: ["event_boundary_leak"] }]
      }
    });

    expect(result.signals).toContain("event_journal_quality_gate_rejected");
    expect(result.deductions).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "event_journal_gate_event_boundary_leak", dimension: "grounding" })])
    );
  });

  it("combines deterministic and judge scores with the configured weighting", () => {
    expect(mergeRuleAndJudgeScores(90, 60)).toBe(72);
    expect(classifyEvaluation(72, false)).toBe("review");
    expect(classifyEvaluation(95, true)).toBe("bad");
  });
});
