import {
  applyTurnUnderstandingResult,
  buildEffectiveUnderstandingView,
  buildTrustedCorrectionAcknowledgement,
  buildTrustedUnderstandingUpdate,
  createEmptyTrustedUnderstandingState,
  deriveAnswerState,
  filterExtractedEvidenceByUnderstanding,
  isTurnUnderstandingV2Enabled,
  parseTrustedUnderstandingState,
  parseTurnUnderstandingResult,
  projectSnapshotFromTrustedUnderstanding,
  shouldMoveAwayFromTarget,
  shouldUseConcreteTargetQuestion,
  type ContentUnderstandingCandidate
} from "@/features/interview/content-understanding";
import {
  INTERVIEW_INTENT_CLASSIFIER_VERSION,
  type IntentAssessmentV1
} from "@/features/interview/intent/intent-v1";
import { buildJoySnapshot, createEmptySnapshot } from "@/features/joy-interview/server/joy-interview-engine";
import type { AssistantQuestionSpec } from "@/types/interview";

function intent(overrides: Partial<IntentAssessmentV1> = {}): IntentAssessmentV1 {
  return {
    version: INTERVIEW_INTENT_CLASSIFIER_VERSION,
    primaryControl: "none",
    controlSignals: [],
    dialogueActs: ["provide_content"],
    content: {
      presence: "clear",
      evidenceText: "今天午休时和同事聊了十分钟",
      explicitAbsence: false,
      answeredTarget: "current_question"
    },
    referenceTarget: "current_question",
    frustration: "none",
    confidence: 0.96,
    origin: "deterministic",
    reasonCodes: [],
    ...overrides
  };
}

function questionSpec(overrides: Partial<AssistantQuestionSpec> = {}): AssistantQuestionSpec {
  return {
    target: "event_anchor",
    stageIntent: "advance",
    surfaceLevel: "default",
    repairCount: 0,
    ...overrides
  };
}

function candidate(
  overrides: Partial<ContentUnderstandingCandidate> = {}
): ContentUnderstandingCandidate {
  return {
    units: [
      {
        kind: "event",
        text: "午休时和同事聊了十分钟",
        evidenceText: "午休时和同事聊了十分钟",
        fields: ["joyMoment"],
        materialStatus: "explicit_confirmed",
        eventRelation: "current_detail",
        relationship: null,
        candidateDimension: null
      }
    ],
    answerState: "answered",
    answeredTarget: "current_question",
    candidateDimensions: [],
    ...overrides
  };
}

function update(input: {
  turnId: string;
  rawText: string;
  assessment?: IntentAssessmentV1;
  understanding?: ContentUnderstandingCandidate | null;
  previousState?: ReturnType<typeof createEmptyTrustedUnderstandingState> | null;
}) {
  const previousSnapshot = createEmptySnapshot();
  const nextSnapshot = buildJoySnapshot({
    joyMoment: "午休时和同事聊了十分钟"
  });
  return buildTrustedUnderstandingUpdate({
    eventId: "event-1",
    dimension: "joy",
    userTurnId: input.turnId,
    sourceMessageSequence: 2,
    rawText: input.rawText,
    intent: input.assessment ?? intent(),
    questionSpec: questionSpec(),
    previousSnapshot,
    nextSnapshot,
    previousState: input.previousState,
    candidate: input.understanding === undefined ? candidate() : input.understanding
  });
}

describe("trusted content understanding", () => {
  it("records grounded current-event material as confirmed evidence", () => {
    const result = update({
      turnId: "turn-1",
      rawText: "今天午休时和同事聊了十分钟，我一下轻松了"
    });

    expect(result.activeMaterials).toHaveLength(1);
    expect(result.activeMaterials[0]).toMatchObject({
      text: "午休时和同事聊了十分钟",
      status: "explicit_confirmed",
      eventRelation: "current_detail",
      sourceTurnId: "turn-1"
    });
    expect(result.state.targetStates.event_anchor).toMatchObject({
      state: "answered",
      attempts: 1
    });
  });

  it("keeps supplemental evidence alongside the earlier material", () => {
    const first = update({
      turnId: "turn-1",
      rawText: "今天午休时和同事聊了十分钟"
    });
    const secondCandidate = candidate({
      units: [
        {
          kind: "event",
          text: "还聊到了下周一起吃饭",
          evidenceText: "还聊到了下周一起吃饭",
          fields: ["joyMoment"],
          materialStatus: "explicit_confirmed",
          eventRelation: "current_detail",
          relationship: null,
          candidateDimension: null
        }
      ]
    });
    const second = update({
      turnId: "turn-2",
      rawText: "补充一下，还聊到了下周一起吃饭",
      assessment: intent({ dialogueActs: ["provide_content", "supplement"] }),
      understanding: secondCandidate,
      previousState: first.state
    });

    expect(second.turn?.updates[0]?.action).toBe("refine");
    expect(second.state.materials.filter((material) => material.status !== "retracted")).toHaveLength(2);
  });

  it("retracts old material immediately when the user explicitly corrects it", () => {
    const first = update({
      turnId: "turn-1",
      rawText: "今天午休时和同事聊了十分钟"
    });
    const correction = candidate({
      units: [
        {
          kind: "correction",
          text: "午休时只聊了两分钟",
          evidenceText: "只聊了两分钟",
          fields: ["joyMoment"],
          materialStatus: "explicit_confirmed",
          eventRelation: "current_detail",
          relationship: null,
          candidateDimension: null
        }
      ]
    });
    const second = update({
      turnId: "turn-2",
      rawText: "刚才说错了，只聊了两分钟",
      assessment: intent({ dialogueActs: ["provide_content", "correct_previous"] }),
      understanding: correction,
      previousState: first.state
    });

    expect(second.turn?.updates[0]?.action).toBe("replace");
    expect(second.state.materials[0]?.status).toBe("retracted");
    expect(second.state.materials[1]).toMatchObject({
      text: "午休时只聊了两分钟",
      supersedes: ["turn-1:0"]
    });
    expect(buildTrustedCorrectionAcknowledgement(second.state)).toContain("午休时只聊了两分钟");
  });

  it("limits a correction to the related material when one field contains several details", () => {
    const first = update({
      turnId: "turn-1",
      rawText: "午休时和同事聊了十分钟"
    });
    const supplemented = update({
      turnId: "turn-2",
      rawText: "她还讲了一个项目插曲",
      previousState: first.state,
      understanding: candidate({
        units: [{
          kind: "event",
          text: "她还讲了一个项目插曲",
          evidenceText: "她还讲了一个项目插曲",
          fields: ["joyMoment"],
          materialStatus: "explicit_confirmed",
          eventRelation: "current_detail",
          relationship: null,
          candidateDimension: null,
          historyRelation: "supplement"
        }]
      })
    });
    const corrected = update({
      turnId: "turn-3",
      rawText: "刚才说错了，其实只聊了两分钟",
      previousState: supplemented.state,
      assessment: intent({ dialogueActs: ["provide_content", "correct_previous"] }),
      understanding: candidate({
        units: [{
          kind: "correction",
          text: "其实只聊了两分钟",
          evidenceText: "其实只聊了两分钟",
          fields: ["joyMoment"],
          materialStatus: "explicit_confirmed",
          eventRelation: "current_detail",
          relationship: null,
          candidateDimension: null,
          historyRelation: "explicit_replace",
          relatedMaterialIds: ["turn-1:0"]
        }]
      })
    });

    expect(corrected.state.materials.find((material) => material.id === "turn-1:0")?.status)
      .toBe("retracted");
    expect(corrected.state.materials.find((material) => material.id === "turn-2:0")?.status)
      .toBe("explicit_confirmed");
  });

  it("retracts a cleared fact when the user withdraws it without a replacement", () => {
    const first = update({
      turnId: "turn-1",
      rawText: "今天午休时和同事聊了十分钟"
    });
    const withdrawn = buildTrustedUnderstandingUpdate({
      eventId: "event-1",
      dimension: "joy",
      userTurnId: "turn-2",
      sourceMessageSequence: 4,
      rawText: "刚才那件事不算，当我没说",
      intent: intent({
        dialogueActs: ["correct_previous"],
        content: {
          presence: "none",
          evidenceText: null,
          explicitAbsence: false,
          answeredTarget: "current_question"
        }
      }),
      questionSpec: questionSpec(),
      previousSnapshot: buildJoySnapshot({ joyMoment: "午休时和同事聊了十分钟" }),
      nextSnapshot: createEmptySnapshot(),
      previousState: first.state,
      candidate: null
    });

    expect(withdrawn.state.materials[0]?.status).toBe("retracted");
    expect(withdrawn.turn?.updates).toContainEqual({
      action: "retract",
      materialId: null,
      fields: ["joyMoment"],
      previousMaterialIds: ["turn-1:0"]
    });
  });

  it("keeps pending inferences out of active evidence and enforced extraction", () => {
    const pending = candidate({
      units: [
        {
          kind: "reason",
          text: "可能是因为被认可",
          evidenceText: null,
          fields: ["joySource"],
          materialStatus: "pending_inference",
          eventRelation: "current_detail",
          relationship: null,
          candidateDimension: null
        }
      ]
    });
    const result = update({
      turnId: "turn-1",
      rawText: "我也说不清为什么",
      understanding: pending
    });
    const filtered = filterExtractedEvidenceByUnderstanding({
      dimension: "joy",
      evidence: { joySource: "可能是因为被认可", tags: [] },
      candidate: pending,
      mode: "enforce"
    });

    expect(result.activeMaterials).toHaveLength(0);
    expect(result.state.materials[0]?.status).toBe("pending_inference");
    expect(filtered.joySource).toBeNull();
  });

  it("withdraws the pending hypothesis tied to the target the user denied", () => {
    const emptySnapshot = createEmptySnapshot();
    const pending = buildTrustedUnderstandingUpdate({
      eventId: "event-gratitude",
      dimension: "gratitude",
      userTurnId: "turn-1",
      sourceMessageSequence: 2,
      rawText: "我也不确定，也许她看见了我很累",
      intent: intent({
        dialogueActs: ["express_uncertainty"],
        content: {
          presence: "possible",
          evidenceText: null,
          explicitAbsence: false,
          answeredTarget: "current_question"
        }
      }),
      questionSpec: questionSpec({
        target: "reaction_evidence",
        subTarget: "seen_need",
        hypothesisKey: "seen_need"
      }),
      previousSnapshot: emptySnapshot,
      nextSnapshot: emptySnapshot,
      candidate: candidate({
        units: [
          {
            kind: "reason",
            text: "她可能看见了我很累",
            evidenceText: null,
            fields: ["seenNeed"],
            materialStatus: "pending_inference",
            eventRelation: "current_detail",
            relationship: null,
            candidateDimension: null
          }
        ],
        answerState: "uncertain",
        answeredTarget: "seen_need"
      })
    });
    const denied = buildTrustedUnderstandingUpdate({
      eventId: "event-gratitude",
      dimension: "gratitude",
      userTurnId: "turn-2",
      sourceMessageSequence: 4,
      rawText: "不是这个，我也不确定",
      intent: intent({
        dialogueActs: ["deny_hypothesis", "express_uncertainty"],
        content: {
          presence: "possible",
          evidenceText: null,
          explicitAbsence: false,
          answeredTarget: "current_question"
        }
      }),
      questionSpec: questionSpec({
        target: "reaction_evidence",
        subTarget: "seen_need",
        hypothesisKey: "seen_need"
      }),
      previousSnapshot: emptySnapshot,
      nextSnapshot: emptySnapshot,
      previousState: pending.state,
      candidate: null
    });

    expect(denied.state.materials[0]?.status).toBe("retracted");
    expect(denied.turn?.updates[0]?.action).toBe("retract");
  });

  it("keeps linked evidence while excluding candidate and incidental events from current materials", () => {
    const relations = candidate({
      units: [
        {
          kind: "reason",
          text: "上周被否定过，所以今天完成时更踏实",
          evidenceText: "上周被否定过，所以今天完成时更踏实",
          fields: ["joySource"],
          materialStatus: "explicit_confirmed",
          eventRelation: "linked_scene",
          relationship: "cause",
          candidateDimension: null
        },
        {
          kind: "event",
          text: "晚上还去河边散步了",
          evidenceText: "晚上还去河边散步了",
          fields: ["joyMoment"],
          materialStatus: "explicit_confirmed",
          eventRelation: "candidate_event",
          relationship: null,
          candidateDimension: "joy"
        },
        {
          kind: "event",
          text: "路上买了一瓶水",
          evidenceText: "路上买了一瓶水",
          fields: ["joyMoment"],
          materialStatus: "explicit_confirmed",
          eventRelation: "incidental",
          relationship: null,
          candidateDimension: null
        }
      ]
    });
    const result = update({
      turnId: "turn-1",
      rawText: "上周被否定过，所以今天完成时更踏实。晚上还去河边散步了，路上买了一瓶水。",
      understanding: relations
    });

    expect(result.activeMaterials.map((material) => material.eventRelation)).toEqual(["linked_scene"]);
    expect(result.state.candidateEvents).toHaveLength(1);
    expect(result.state.candidateDimensions).toEqual(["joy"]);
  });

  it.each([
    ["explicit_absence", "确实没有", intent({ content: { presence: "clear", evidenceText: "确实没有", explicitAbsence: true, answeredTarget: "current_question" } })],
    ["recall_unavailable", "我一时想不起来", intent({ content: { presence: "possible", evidenceText: null, explicitAbsence: false, answeredTarget: null } })],
    ["uncertain", "我还不确定", intent({ dialogueActs: ["express_uncertainty"], content: { presence: "possible", evidenceText: null, explicitAbsence: false, answeredTarget: null } })],
    ["declined", "这个我不想说", intent({ dialogueActs: ["decline_answer"], content: { presence: "none", evidenceText: null, explicitAbsence: false, answeredTarget: null } })]
  ] as const)("distinguishes %s from other missing-answer states", (expected, rawText, assessment) => {
    expect(deriveAnswerState({ rawText, intent: assessment })).toBe(expected);
  });

  it("uses answer history to lower pressure and stop repeating a closed target", () => {
    const base = createEmptyTrustedUnderstandingState({ eventId: "event-1", dimension: "gratitude" });
    const uncertain = {
      ...base,
      targetStates: {
        seen_need: {
          target: "seen_need" as const,
          state: "uncertain" as const,
          evidenceText: "我还不确定",
          sourceTurnId: "turn-1",
          attempts: 1,
          history: [{
            state: "uncertain" as const,
            evidenceText: "我还不确定",
            sourceTurnId: "turn-1"
          }]
        }
      }
    };
    const declined = {
      ...uncertain,
      targetStates: {
        seen_need: {
          ...uncertain.targetStates.seen_need,
          state: "declined" as const
        }
      }
    };

    expect(shouldUseConcreteTargetQuestion(uncertain, "seen_need")).toBe(true);
    expect(shouldMoveAwayFromTarget(uncertain, "seen_need")).toBe(false);
    expect(shouldMoveAwayFromTarget(declined, "seen_need")).toBe(true);
  });

  it("reopens a declined target when the user later provides content and preserves its history", () => {
    const declined = buildTrustedUnderstandingUpdate({
      eventId: "event-gratitude",
      dimension: "gratitude",
      userTurnId: "turn-decline",
      sourceMessageSequence: 2,
      rawText: "这部分我不想说",
      intent: intent({
        dialogueActs: ["decline_answer"],
        content: { presence: "none", evidenceText: null, explicitAbsence: false, answeredTarget: null }
      }),
      questionSpec: questionSpec({ target: "reaction_evidence", subTarget: "seen_need" }),
      previousSnapshot: createEmptySnapshot(),
      nextSnapshot: createEmptySnapshot(),
      candidate: candidate({
        units: [],
        answerState: "declined",
        answeredTarget: "seen_need"
      })
    });
    const reopened = buildTrustedUnderstandingUpdate({
      eventId: "event-gratitude",
      dimension: "gratitude",
      userTurnId: "turn-reopen",
      sourceMessageSequence: 4,
      rawText: "其实她看见了我当时很累",
      intent: intent({
        content: { presence: "clear", evidenceText: "她看见了我当时很累", explicitAbsence: false, answeredTarget: "current_question" }
      }),
      questionSpec: questionSpec({ target: "reaction_evidence", subTarget: "seen_need" }),
      previousSnapshot: createEmptySnapshot(),
      nextSnapshot: buildJoySnapshot({ seenNeed: "她看见了我当时很累" }),
      previousState: declined.state,
      candidate: candidate({
        units: [{
          kind: "reason",
          text: "她看见了我当时很累",
          evidenceText: "她看见了我当时很累",
          fields: ["seenNeed"],
          materialStatus: "explicit_confirmed",
          eventRelation: "current_detail",
          relationship: null,
          candidateDimension: null
        }],
        answerState: "answered",
        answeredTarget: "seen_need"
      })
    });

    expect(reopened.state.targetStates.seen_need).toMatchObject({
      state: "answered",
      attempts: 1
    });
    expect(reopened.state.targetStates.seen_need?.history.map((item) => item.state))
      .toEqual(["declined", "answered"]);
  });

  it("returns the same state when the same user turn is replayed", () => {
    const first = update({
      turnId: "turn-1",
      rawText: "今天午休时和同事聊了十分钟"
    });
    const replay = update({
      turnId: "turn-1",
      rawText: "今天午休时和同事聊了十分钟",
      previousState: first.state
    });

    expect(replay.state).toEqual(first.state);
  });

  it("records multiple answer targets independently in one user turn", () => {
    const rawText = "她确实帮我改了方案，但我不确定她是不是理解我的压力，这部分我不想继续说。";
    const result = buildTrustedUnderstandingUpdate({
      eventId: "event-gratitude",
      dimension: "gratitude",
      userTurnId: "turn-multi-target",
      sourceMessageSequence: 2,
      rawText,
      intent: intent({
        dialogueActs: ["provide_content", "express_uncertainty", "decline_answer"],
        content: {
          presence: "clear",
          evidenceText: rawText,
          explicitAbsence: false,
          answeredTarget: "current_question"
        }
      }),
      questionSpec: questionSpec({ target: "event_anchor", subTarget: "kind_action" }),
      previousSnapshot: createEmptySnapshot(),
      nextSnapshot: buildJoySnapshot({
        gratitudeMoment: "她帮我改了方案",
        kindAction: "她帮我改了方案"
      }),
      candidate: candidate({
        units: [
          {
            kind: "action",
            text: "她帮我改了方案",
            evidenceText: "她确实帮我改了方案",
            fields: ["kindAction"],
            materialStatus: "explicit_confirmed",
            eventRelation: "current_detail",
            relationship: null,
            candidateDimension: null
          },
          {
            kind: "judgment",
            text: "她理解我的压力",
            evidenceText: null,
            fields: ["seenNeed"],
            materialStatus: "pending_inference",
            eventRelation: "current_detail",
            relationship: null,
            candidateDimension: null
          }
        ],
        answerState: "answered",
        answeredTarget: "kind_action",
        targetResponses: [
          {
            target: "kind_action",
            state: "answered",
            evidenceText: "她确实帮我改了方案",
            materialIndexes: [0]
          },
          {
            target: "seen_need",
            state: "uncertain",
            evidenceText: "我不确定她是不是理解我的压力",
            materialIndexes: [1]
          },
          {
            target: "relationship_signal",
            state: "declined",
            evidenceText: "这部分我不想继续说",
            materialIndexes: []
          }
        ]
      })
    });

    expect(result.result?.targetResponses).toHaveLength(3);
    expect(result.state.targetStates).toMatchObject({
      kind_action: { state: "answered" },
      seen_need: { state: "uncertain" },
      relationship_signal: { state: "declined" }
    });
    for (const response of result.result?.targetResponses ?? []) {
      expect(rawText.slice(response.evidenceStart, response.evidenceEnd)).toBe(response.evidenceText);
    }
  });

  it("keeps the old material active when a new expression creates an ambiguous conflict", () => {
    const oldSnapshot = buildJoySnapshot({ joySource: "因为被认可" });
    const first = buildTrustedUnderstandingUpdate({
      eventId: "event-1",
      dimension: "joy",
      userTurnId: "turn-old",
      sourceMessageSequence: 2,
      rawText: "让我开心是因为被认可。",
      intent: intent({ content: { presence: "clear", evidenceText: "因为被认可", explicitAbsence: false, answeredTarget: "current_question" } }),
      questionSpec: questionSpec({ target: "insight_evidence" }),
      previousSnapshot: createEmptySnapshot(),
      nextSnapshot: oldSnapshot,
      candidate: candidate({
        units: [{
          kind: "reason",
          text: "因为被认可",
          evidenceText: "因为被认可",
          fields: ["joySource"],
          materialStatus: "explicit_confirmed",
          eventRelation: "current_detail",
          relationship: null,
          candidateDimension: null
        }],
        answeredTarget: "insight_evidence"
      })
    });
    const second = buildTrustedUnderstandingUpdate({
      eventId: "event-1",
      dimension: "joy",
      userTurnId: "turn-conflict",
      sourceMessageSequence: 4,
      rawText: "也许更像是因为被需要，我还没想清。",
      intent: intent({
        dialogueActs: ["provide_content", "express_uncertainty"],
        content: { presence: "clear", evidenceText: "因为被需要", explicitAbsence: false, answeredTarget: "current_question" }
      }),
      questionSpec: questionSpec({ target: "insight_evidence" }),
      previousSnapshot: oldSnapshot,
      nextSnapshot: buildJoySnapshot({ joySource: "因为被需要" }),
      previousState: first.state,
      candidate: candidate({
        units: [{
          kind: "reason",
          text: "因为被需要",
          evidenceText: "因为被需要",
          fields: ["joySource"],
          materialStatus: "explicit_confirmed",
          eventRelation: "current_detail",
          relationship: null,
          candidateDimension: null,
          historyRelation: "ambiguous_conflict",
          relatedMaterialIds: ["turn-old:0"]
        }],
        answerState: "uncertain",
        answeredTarget: "insight_evidence"
      })
    });
    const view = buildEffectiveUnderstandingView(second.state, "joy");
    const projected = projectSnapshotFromTrustedUnderstanding({
      dimension: "joy",
      snapshot: buildJoySnapshot({ joySource: "因为被需要" }),
      state: second.state
    });

    expect(second.state.materials).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "turn-old:0", text: "因为被认可", status: "explicit_confirmed" }),
      expect.objectContaining({ id: "turn-conflict:0", text: "因为被需要", status: "pending_inference" })
    ]));
    expect(second.result?.conflicts).toHaveLength(1);
    expect(second.result?.journalMaterialsChanged).toBe(false);
    expect(view.journalMaterials.map((material) => material.text)).toContain("因为被认可");
    expect(view.journalMaterials.map((material) => material.text)).not.toContain("因为被需要");
    expect(projected.joySource).toBe("因为被认可");
  });

  it("upgrades a pending material after confirmation and replays the persisted result identically", () => {
    const oldSnapshot = buildJoySnapshot({ joySource: "因为被认可" });
    const first = buildTrustedUnderstandingUpdate({
      eventId: "event-1",
      dimension: "joy",
      userTurnId: "turn-old",
      sourceMessageSequence: 2,
      rawText: "让我开心是因为被认可。",
      intent: intent(),
      questionSpec: questionSpec({ target: "insight_evidence" }),
      previousSnapshot: createEmptySnapshot(),
      nextSnapshot: oldSnapshot,
      candidate: candidate({ units: [{ kind: "reason", text: "因为被认可", evidenceText: "因为被认可", fields: ["joySource"], materialStatus: "explicit_confirmed", eventRelation: "current_detail", relationship: null, candidateDimension: null }] })
    });
    const conflicted = buildTrustedUnderstandingUpdate({
      eventId: "event-1",
      dimension: "joy",
      userTurnId: "turn-conflict",
      sourceMessageSequence: 4,
      rawText: "也许更像是因为被需要。",
      intent: intent({ dialogueActs: ["provide_content", "express_uncertainty"] }),
      questionSpec: questionSpec({ target: "insight_evidence" }),
      previousSnapshot: oldSnapshot,
      nextSnapshot: buildJoySnapshot({ joySource: "因为被需要" }),
      previousState: first.state,
      candidate: candidate({ units: [{ kind: "reason", text: "因为被需要", evidenceText: "因为被需要", fields: ["joySource"], materialStatus: "explicit_confirmed", eventRelation: "current_detail", relationship: null, candidateDimension: null, historyRelation: "ambiguous_conflict", relatedMaterialIds: ["turn-old:0"] }] })
    });
    const confirmed = buildTrustedUnderstandingUpdate({
      eventId: "event-1",
      dimension: "joy",
      userTurnId: "turn-confirm",
      sourceMessageSequence: 6,
      rawText: "对，就是因为被需要。",
      intent: intent({ content: { presence: "clear", evidenceText: "因为被需要", explicitAbsence: false, answeredTarget: "current_question" } }),
      questionSpec: questionSpec({ target: "insight_evidence" }),
      previousSnapshot: oldSnapshot,
      nextSnapshot: buildJoySnapshot({ joySource: "因为被需要" }),
      previousState: conflicted.state,
      candidate: candidate({ units: [{ kind: "reason", text: "因为被需要", evidenceText: "因为被需要", fields: ["joySource"], materialStatus: "explicit_confirmed", eventRelation: "current_detail", relationship: null, candidateDimension: null, historyRelation: "confirm_pending", relatedMaterialIds: ["turn-conflict:0"] }] })
    });

    expect(confirmed.state.materials.find((material) => material.id === "turn-conflict:0")?.status)
      .toBe("explicit_confirmed");
    expect(confirmed.state.materials.find((material) => material.id === "turn-old:0")?.status)
      .toBe("retracted");
    expect(confirmed.state.conflicts[0]).toMatchObject({
      status: "resolved",
      resolvedByTurnId: "turn-confirm"
    });
    expect(confirmed.result?.journalMaterialsChanged).toBe(true);
    expect(parseTurnUnderstandingResult(confirmed.result)).not.toBeNull();
    expect(applyTurnUnderstandingResult({
      previousState: conflicted.state,
      result: confirmed.result!
    })).toEqual(confirmed.state);
  });

  it("rejects malformed persisted understanding data", () => {
    expect(parseTrustedUnderstandingState({ version: "unknown" })).toBeNull();
  });

  it("selects the new understanding protocol for the configured validation accounts", () => {
    const previousVersion = process.env.INTERVIEW_UNDERSTANDING_VERSION;
    const previousUsers = process.env.INTERVIEW_UNDERSTANDING_V2_USER_IDS;
    process.env.INTERVIEW_UNDERSTANDING_VERSION = "1";
    process.env.INTERVIEW_UNDERSTANDING_V2_USER_IDS = "user-a, user-b";

    expect(isTurnUnderstandingV2Enabled("user-a")).toBe(true);
    expect(isTurnUnderstandingV2Enabled("user-c")).toBe(false);

    if (previousVersion === undefined) delete process.env.INTERVIEW_UNDERSTANDING_VERSION;
    else process.env.INTERVIEW_UNDERSTANDING_VERSION = previousVersion;
    if (previousUsers === undefined) delete process.env.INTERVIEW_UNDERSTANDING_V2_USER_IDS;
    else process.env.INTERVIEW_UNDERSTANDING_V2_USER_IDS = previousUsers;
  });
});
