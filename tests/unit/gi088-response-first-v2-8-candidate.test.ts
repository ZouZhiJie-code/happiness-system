import { describe, expect, it } from "vitest";

import {
  GI088_RESPONSE_FIRST_V27_HIGH_ASSETS,
  GI088_RESPONSE_FIRST_V27_RUNTIME,
  createGi088ResponseFirstV27HighUserPrompt,
  createGi088ResponseFirstV27Identity
} from "../../evals/event-centered-generative/gi088-response-first-v2-7-thinking-disabled-audited-high/candidate";
import {
  GI088_RESPONSE_FIRST_V28_CORRECTION_PERSISTENCE_CONTRACT,
  GI088_RESPONSE_FIRST_V28_HIGH_ASSETS,
  GI088_RESPONSE_FIRST_V28_RUNTIME,
  GI088_RESPONSE_FIRST_V28_VERSION,
  createGi088ResponseFirstV28HighUserPrompt,
  createGi088ResponseFirstV28Identity,
  getGi088ResponseFirstV28HighSystemPrompt,
  observeGi088ResponseFirstV28CorrectionPersistenceAudit,
  observeGi088ResponseFirstV28HighOutput,
  observeGi088ResponseFirstV28InformationGainAudit,
  parseGi088ResponseFirstV28HighOutput,
  projectGi088ResponseFirstV28VisibleAppend,
  validateGi088ResponseFirstV28HighOutput
} from "../../evals/event-centered-generative/gi088-response-first-v2-8-correction-persistence-high/candidate";
import {
  loadGi088ResponseFirstV22RubricV13Cases
} from "../../scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures";

type Audit =
  | {
      decision: "none";
      correctedMeaning: null;
      supersededAssistantMessageRefs: never[];
      statePlan: null;
    }
  | {
      decision: "persist";
      correctedMeaning: {
        summary: string;
        evidenceRefs: string[];
      };
      supersededAssistantMessageRefs: string[];
      statePlan: {
        task:
          | { kind: "set_new" }
          | { kind: "continue"; targetRef: string };
        understanding:
          | { kind: "add" }
          | { kind: "revise" | "invalidate"; targetRef: string };
      };
    };

const noAudit = {
  decision: "none",
  correctedMeaning: null,
  supersededAssistantMessageRefs: [],
  statePlan: null
} as const satisfies Audit;

function highOutput(input?: {
  audit?: Audit;
  taskChange?: Record<string, unknown>;
  understandingChange?: Record<string, unknown>;
  questions?: string[];
  candidates?: Array<{
    question: string;
    existingAnswer: {
      summary: string;
      evidenceRefs: string[];
    } | null;
    worthAsking: boolean;
  }>;
}) {
  const questions = input?.questions ?? [];
  return JSON.stringify({
    correctionPersistenceAudit: input?.audit ?? noAudit,
    semantic: {
      actionIntent: questions.length > 0 ? "ask" : "acknowledge",
      taskChange: input?.taskChange ?? { kind: "unchanged" },
      understandingChange:
        input?.understandingChange ?? { kind: "none" },
      nextResponse: questions.length > 0
        ? {
            decision: "ask",
            answerFocus: "用户纠正后仍然在意的部分",
            informationGoal: "理解用户仍然在意的具体焦点",
            expectedUnderstandingChange: "明确纠正后值得继续探索的焦点",
            evidenceRefs: ["U3"],
            questions
          }
        : {
            decision: "none",
            answerFocus: null,
            informationGoal: null,
            expectedUnderstandingChange: null,
            evidenceRefs: [],
            questions: []
          },
      burdenAndControlChange: { kind: "unchanged" },
      relationshipExplanations: []
    },
    visibleAppend: { correctableUnderstanding: null },
    informationGainAudit: { candidates: input?.candidates ?? [] }
  });
}

function nullTaskPersistAudit(input?: {
  evidenceRefs?: string[];
  supersededAssistantMessageRefs?: string[];
}): Audit {
  return {
    decision: "persist",
    correctedMeaning: {
      summary: "用户纠正了此前的接纳理解，仍然在意这件事",
      evidenceRefs: input?.evidenceRefs ?? ["U3"]
    },
    supersededAssistantMessageRefs:
      input?.supersededAssistantMessageRefs ?? ["A2"],
    statePlan: {
      task: { kind: "set_new" },
      understanding: { kind: "add" }
    }
  };
}

function nullTaskPersistOutput(input?: {
  audit?: Audit;
  questions?: string[];
  candidates?: Array<{
    question: string;
    existingAnswer: {
      summary: string;
      evidenceRefs: string[];
    } | null;
    worthAsking: boolean;
  }>;
}) {
  return highOutput({
    audit: input?.audit ?? nullTaskPersistAudit(),
    taskChange: {
      kind: "set",
      continuity: "new",
      targetRef: null,
      summary: "沿用户纠正后仍然在意的部分继续",
      evidenceRefs: ["U3"]
    },
    understandingChange: {
      kind: "add",
      summary: "用户纠正了此前的接纳理解，仍然在意这件事",
      evidenceRefs: ["U3"]
    },
    questions: input?.questions,
    candidates: input?.candidates
  });
}

async function caseById(
  caseId: "RPR-REAL-19-CORRECTION" | "RPR-REAL-19-CONTINUE"
) {
  const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
  return dataset.cases.find((candidate) => candidate.caseId === caseId)!;
}

describe("GI-088 response-first v2.8 correction persistence High", () => {
  it("inherits v2.7 runtime and delivery contracts while changing only the audit-first method", async () => {
    const parent = createGi088ResponseFirstV27Identity();
    const identity = createGi088ResponseFirstV28Identity();
    const item = await caseById("RPR-REAL-19-CORRECTION");
    const promptInput = { turnInput: item.turnInput, frozenLow: "冻结 Low" };

    expect(identity.version).toBe(GI088_RESPONSE_FIRST_V28_VERSION);
    expect(identity.parentVersion).toBe(parent.version);
    expect(identity.parentCandidateFingerprint).toBe(
      parent.candidateFingerprint
    );
    expect(identity.runtime).toEqual(GI088_RESPONSE_FIRST_V27_RUNTIME);
    expect(GI088_RESPONSE_FIRST_V28_RUNTIME).toBe(
      GI088_RESPONSE_FIRST_V27_RUNTIME
    );
    expect(identity.runtime.high).toMatchObject({
      thinking: "disabled",
      maxTokens: 4_000
    });
    expect(identity.runtime.high).not.toHaveProperty("reasoningEffort");
    expect(identity.visibleDeliveryContractFingerprint).toBe(
      parent.visibleDeliveryContractFingerprint
    );
    expect(identity.informationGainAuditContractFingerprint).toBe(
      parent.informationGainAuditContractFingerprint
    );
    expect(identity.changedFactor).toBe(
      "audit_first_explicit_correction_persistence_only"
    );
    expect(GI088_RESPONSE_FIRST_V28_HIGH_ASSETS.basePrompt).toBe(
      GI088_RESPONSE_FIRST_V27_HIGH_ASSETS.basePrompt
    );
    expect(createGi088ResponseFirstV28HighUserPrompt(promptInput)).toBe(
      createGi088ResponseFirstV27HighUserPrompt(promptInput)
    );
    expect(GI088_RESPONSE_FIRST_V28_CORRECTION_PERSISTENCE_CONTRACT)
      .toMatchObject({
        firstTopLevelField: "correctionPersistenceAudit",
        semanticDetectionOwner: "model_and_quality_review"
      });
    const systemPrompt = getGi088ResponseFirstV28HighSystemPrompt();
    expect(systemPrompt).toContain(
      "correctionPersistenceAudit 必须作为 JSON 第一段"
    );
    expect(systemPrompt.indexOf('"correctionPersistenceAudit"')).toBeLessThan(
      systemPrompt.indexOf('"semantic"')
    );
  });

  it("requires the audit as the first top-level field and rejects extra fields", () => {
    expect(() => parseGi088ResponseFirstV28HighOutput(highOutput()))
      .not.toThrow();

    const valid = JSON.parse(highOutput()) as Record<string, unknown>;
    const reordered = JSON.stringify({
      semantic: valid.semantic,
      correctionPersistenceAudit: valid.correctionPersistenceAudit,
      visibleAppend: valid.visibleAppend,
      informationGainAudit: valid.informationGainAudit
    });
    expect(() => parseGi088ResponseFirstV28HighOutput(reordered)).toThrow(
      "GI088_RESPONSE_FIRST_V28_CORRECTION_AUDIT_MUST_BE_FIRST"
    );

    expect(() => parseGi088ResponseFirstV28HighOutput(JSON.stringify({
      ...valid,
      extra: true
    }))).toThrow();
    expect(() => parseGi088ResponseFirstV28HighOutput(JSON.stringify({
      ...valid,
      correctionPersistenceAudit: {
        ...(valid.correctionPersistenceAudit as Record<string, unknown>),
        extra: true
      }
    }))).toThrow();
  });

  it("persists an explicit correction into a new task and understanding when state is empty", async () => {
    const item = await caseById("RPR-REAL-19-CORRECTION");
    const high = parseGi088ResponseFirstV28HighOutput(
      nullTaskPersistOutput()
    );

    expect(validateGi088ResponseFirstV28HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toEqual([]);
    expect(projectGi088ResponseFirstV28VisibleAppend({
      frozenLow: "冻结 Low",
      high
    })).toEqual({
      lowText: "冻结 Low",
      highUnderstanding: null,
      questions: [],
      completion: "high_complete"
    });
    expect(observeGi088ResponseFirstV28CorrectionPersistenceAudit(high))
      .toMatchObject({
        decision: "persist",
        correctedMeaningEvidenceRefs: ["U3"],
        supersededAssistantMessageRefs: ["A2"],
        taskPlanKind: "set_new",
        understandingPlanKind: "add"
      });
  });

  it("rejects a persist declaration that leaves empty state unchanged", async () => {
    const item = await caseById("RPR-REAL-19-CORRECTION");
    const high = parseGi088ResponseFirstV28HighOutput(highOutput({
      audit: nullTaskPersistAudit()
    }));
    const issues = validateGi088ResponseFirstV28HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    });

    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_TASK_SET_NEW_MISMATCH"
    );
    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_UNDERSTANDING_ADD_MISMATCH"
    );
  });

  it("requires an empty-state persist plan to declare set_new plus add", async () => {
    const item = await caseById("RPR-REAL-19-CORRECTION");
    const high = parseGi088ResponseFirstV28HighOutput(highOutput({
      audit: {
        decision: "persist",
        correctedMeaning: {
          summary: "用户纠正了当前认识",
          evidenceRefs: ["U3"]
        },
        supersededAssistantMessageRefs: ["A2"],
        statePlan: {
          task: { kind: "continue", targetRef: "task-stale" },
          understanding: { kind: "revise", targetRef: "state-stale" }
        }
      },
      taskChange: {
        kind: "set",
        continuity: "continue",
        targetRef: "task-stale",
        summary: "沿纠正后的重点继续",
        evidenceRefs: ["U3"]
      },
      understandingChange: {
        kind: "revise",
        targetRef: "state-stale",
        summary: "用户纠正了当前认识",
        evidenceRefs: ["U3"]
      }
    }));
    const issues = validateGi088ResponseFirstV28HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    });

    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_NULL_TASK_REQUIRES_SET_NEW"
    );
    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_NULL_TASK_REQUIRES_ADD"
    );
  });

  it("maps corrected meaning and evidence into the declared semantic changes", async () => {
    const item = await caseById("RPR-REAL-19-CORRECTION");
    const high = parseGi088ResponseFirstV28HighOutput(highOutput({
      audit: nullTaskPersistAudit(),
      taskChange: {
        kind: "set",
        continuity: "new",
        targetRef: null,
        summary: "沿用户纠正后的重点继续",
        evidenceRefs: ["U2"]
      },
      understandingChange: {
        kind: "add",
        summary: "与审计声明不同的含义",
        evidenceRefs: ["U2"]
      }
    }));
    const issues = validateGi088ResponseFirstV28HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    });

    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_TASK_EVIDENCE_MISMATCH"
    );
    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_UNDERSTANDING_SUMMARY_MISMATCH"
    );
    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_UNDERSTANDING_EVIDENCE_MISMATCH"
    );
  });

  it("validates correction user evidence, latest-user inclusion, and assistant lineage", async () => {
    const item = await caseById("RPR-REAL-19-CORRECTION");
    const high = parseGi088ResponseFirstV28HighOutput(
      nullTaskPersistOutput({
        audit: nullTaskPersistAudit({
          evidenceRefs: ["U2", "U2", "A2"],
          supersededAssistantMessageRefs: ["A2", "A2", "U2"]
        })
      })
    );
    const issues = validateGi088ResponseFirstV28HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    });

    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_USER_SOURCE_INVALID:A2"
    );
    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_USER_SOURCE_DUPLICATED"
    );
    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_LATEST_USER_SOURCE_REQUIRED"
    );
    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_ASSISTANT_SOURCE_INVALID:U2"
    );
    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_ASSISTANT_SOURCE_DUPLICATED"
    );
  });

  it("maps an existing correction to the current task and revises the declared active understanding", async () => {
    const item = await caseById("RPR-REAL-19-CONTINUE");
    const summary = "用户修订了当前理解，并希望沿修订后的重点继续";
    const high = parseGi088ResponseFirstV28HighOutput(highOutput({
      audit: {
        decision: "persist",
        correctedMeaning: {
          summary,
          evidenceRefs: ["U3", "U4"]
        },
        supersededAssistantMessageRefs: ["A3"],
        statePlan: {
          task: {
            kind: "continue",
            targetRef: "task-rpr-real-19-after-correction"
          },
          understanding: {
            kind: "revise",
            targetRef: "state-rpr-real-19-correction-accepted"
          }
        }
      },
      taskChange: {
        kind: "set",
        continuity: "continue",
        targetRef: "task-rpr-real-19-after-correction",
        summary: "沿用户修订后的真实重点继续探索",
        evidenceRefs: ["U3", "U4"]
      },
      understandingChange: {
        kind: "revise",
        targetRef: "state-rpr-real-19-correction-accepted",
        summary,
        evidenceRefs: ["U3", "U4"]
      }
    }));

    expect(validateGi088ResponseFirstV28HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toEqual([]);
  });

  it("supports a declared withdrawal by invalidating an active understanding", async () => {
    const item = await caseById("RPR-REAL-19-CONTINUE");
    const high = parseGi088ResponseFirstV28HighOutput(highOutput({
      audit: {
        decision: "persist",
        correctedMeaning: {
          summary: "用户撤回了当前认识",
          evidenceRefs: ["U4"]
        },
        supersededAssistantMessageRefs: ["A3"],
        statePlan: {
          task: {
            kind: "continue",
            targetRef: "task-rpr-real-19-after-correction"
          },
          understanding: {
            kind: "invalidate",
            targetRef: "state-rpr-real-19-correction-accepted"
          }
        }
      },
      taskChange: {
        kind: "set",
        continuity: "continue",
        targetRef: "task-rpr-real-19-after-correction",
        summary: "沿用户当前仍有效的重点继续",
        evidenceRefs: ["U4"]
      },
      understandingChange: {
        kind: "invalidate",
        targetRef: "state-rpr-real-19-correction-accepted",
        reason: "用户明确撤回当前认识"
      }
    }));

    expect(validateGi088ResponseFirstV28HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toEqual([]);
  });

  it("rejects state-plan targets that are not current and active", async () => {
    const item = await caseById("RPR-REAL-19-CONTINUE");
    const high = parseGi088ResponseFirstV28HighOutput(highOutput({
      audit: {
        decision: "persist",
        correctedMeaning: {
          summary: "用户修订了当前认识",
          evidenceRefs: ["U4"]
        },
        supersededAssistantMessageRefs: ["A3"],
        statePlan: {
          task: { kind: "continue", targetRef: "task-stale" },
          understanding: { kind: "revise", targetRef: "state-stale" }
        }
      },
      taskChange: {
        kind: "set",
        continuity: "continue",
        targetRef: "task-stale",
        summary: "沿用户当前重点继续",
        evidenceRefs: ["U4"]
      },
      understandingChange: {
        kind: "revise",
        targetRef: "state-stale",
        summary: "用户修订了当前认识",
        evidenceRefs: ["U4"]
      }
    }));
    const issues = validateGi088ResponseFirstV28HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    });

    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_TASK_TARGET_NOT_CURRENT"
    );
    expect(issues).toContain(
      "CORRECTION_PERSISTENCE_UNDERSTANDING_TARGET_NOT_ACTIVE"
    );
  });

  it("allows decision none without program-side semantic classification", async () => {
    const item = await caseById("RPR-REAL-19-CORRECTION");
    const high = parseGi088ResponseFirstV28HighOutput(highOutput());

    expect(validateGi088ResponseFirstV28HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toEqual([]);
    expect(observeGi088ResponseFirstV28CorrectionPersistenceAudit(high))
      .toEqual({
        decision: "none",
        correctedMeaningPresent: false,
        correctedMeaningEvidenceRefs: [],
        supersededAssistantMessageRefs: [],
        taskPlanKind: null,
        taskTargetRef: null,
        understandingPlanKind: null,
        understandingTargetRef: null
      });
  });

  it("preserves the v2.7 question audit and exact visible-question mapping", async () => {
    const item = await caseById("RPR-REAL-19-CORRECTION");
    const question = "你现在最想继续理清的是哪一部分？";
    const high = parseGi088ResponseFirstV28HighOutput(
      nullTaskPersistOutput({
        questions: [question],
        candidates: [{
          question,
          existingAnswer: null,
          worthAsking: true
        }]
      })
    );

    expect(validateGi088ResponseFirstV28HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toEqual([]);
    expect(observeGi088ResponseFirstV28HighOutput(high)).toMatchObject({
      candidateCount: 1,
      selectedQuestionCount: 1
    });
    expect(observeGi088ResponseFirstV28InformationGainAudit(high))
      .toEqual(observeGi088ResponseFirstV28HighOutput(high));
    expect(projectGi088ResponseFirstV28VisibleAppend({
      frozenLow: "冻结 Low",
      high
    }).questions).toEqual([question]);
  });
});
