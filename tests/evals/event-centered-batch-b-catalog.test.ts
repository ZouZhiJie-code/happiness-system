import {
  EVENT_CENTERED_QUALITY_ISSUES,
  EVENT_CENTERED_SAFETY_BLOCKERS,
  batchBAngleCases,
  batchBEvaluationCatalog,
  batchBPublicProtocolCases,
  batchBSafetyCases,
  classifyEventCenteredViolation,
  evaluateBatchBObservation
} from "@/features/interview/event-centered/evaluation-catalog";
import {
  batchBAngleSelectionProjectionSchema,
  batchBEvaluationInputSchema
} from "@/features/interview/event-centered/evaluation-schema";

describe("Batch B event-centered evaluation catalog", () => {
  it("keeps the agreed formal suite sizes and stable unique ids", () => {
    expect(batchBPublicProtocolCases).toHaveLength(120);
    expect(batchBAngleCases.feeling).toHaveLength(100);
    expect(batchBAngleCases.thought).toHaveLength(100);
    expect(batchBAngleCases.relationship).toHaveLength(100);
    expect(batchBAngleCases.action).toHaveLength(100);
    expect(batchBSafetyCases).toHaveLength(60);
    expect(batchBEvaluationCatalog).toHaveLength(580);
    expect(new Set(batchBEvaluationCatalog.map((item) => item.id)).size).toBe(580);
    expect(batchBEvaluationCatalog.every((item) => /^EVB-(PUB|FEE|THO|REL|ACT|SAF)-\d{3}$/u.test(item.id))).toBe(true);
  });

  it("gives every case a concrete product expectation", () => {
    for (const item of batchBEvaluationCatalog) {
      expect(batchBEvaluationInputSchema.safeParse(item.input).success).toBe(true);
      if (item.input.kind === "text") {
        expect(item.input.text.trim().length).toBeGreaterThan(0);
        expect(item.userText).toBe(item.input.text);
      } else {
        expect(item.input.action).toMatch(/^(select_current_event|select_exploration_angle|continue_exploration|exit_event)$/u);
        expect(item.userText).toBeNull();
      }
      expect(item.rationale.trim().length).toBeGreaterThan(0);
      expect(item.expected.maxNewQuestions).toBeLessThanOrEqual(1);
      expect(item.context.answerOpportunityCount).toBeLessThanOrEqual(3);
      if (item.input.kind === "reliable_action" && item.input.action === "select_exploration_angle") {
        expect(batchBAngleSelectionProjectionSchema.safeParse(item.expected.angleSelection).success).toBe(true);
        expect(item.expected.angleSelection).toMatchObject({
          phase: "guided_reflection",
          activeAngle: item.input.angle,
          questionTarget: item.expected.questionTarget,
          answerOpportunityDelta: item.expected.answerOpportunityDelta
        });
      } else {
        expect(item.expected.angleSelection).toBeNull();
      }
      if (item.expected.nextMove === "block_response") {
        expect(item.candidateResponse?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("counts repaired questions while textual boundaries consume no new opportunity", () => {
    const repairCases = batchBPublicProtocolCases.filter((item) => item.family === "repair_creates_new_answer_opportunity");
    const boundaryCases = batchBPublicProtocolCases.filter((item) => item.family === "text_boundary_closes_current_angle");

    expect(repairCases).toHaveLength(10);
    expect(boundaryCases).toHaveLength(10);
    expect(repairCases.every((item) => item.expected.answerOpportunityDelta === 1)).toBe(true);
    expect(boundaryCases.every((item) => item.expected.answerOpportunityDelta === 0)).toBe(true);
    expect(boundaryCases.every((item) => item.expected.maxNewQuestions === 0)).toBe(true);
    expect(boundaryCases.every((item) => item.expected.nextMove === "checkpoint_two")).toBe(true);
    expect(boundaryCases.every((item) => item.expected.outcomeKind === null)).toBe(true);
  });

  it("separates exhausted event anchors from explicit corrections", () => {
    const exhaustedAnchorCases = batchBPublicProtocolCases.filter(
      (item) => item.family === "vague_event_still_reaches_checkpoint"
    );
    const correctionCases = batchBPublicProtocolCases.filter(
      (item) => item.family === "explicit_correction_after_angry_claim"
    );

    expect(exhaustedAnchorCases).toHaveLength(10);
    expect(exhaustedAnchorCases.every((item) => item.context.lowPressureAnchorUsed)).toBe(true);
    expect(exhaustedAnchorCases.every((item) => item.expected.nextMove === "checkpoint_one")).toBe(true);
    expect(exhaustedAnchorCases.every((item) =>
      item.input.kind === "text" && item.input.text !== "我没有生气。"
    )).toBe(true);

    expect(correctionCases).toHaveLength(10);
    expect(correctionCases.every((item) => item.context.lastQuestion?.includes("生气"))).toBe(true);
    expect(correctionCases.every((item) => item.expected.nextMove === "checkpoint_two")).toBe(true);
    expect(correctionCases.every((item) => item.expected.maxNewQuestions === 0)).toBe(true);
    expect(correctionCases.every((item) => item.expected.outcomeKind === null)).toBe(true);
    expect(correctionCases.every((item) =>
      item.input.kind === "text" && /生气/u.test(item.input.text)
    )).toBe(true);
  });

  it("keeps bare change-angle language on the active question", () => {
    const cases = batchBPublicProtocolCases.filter((item) => item.family === "bare_change_angle_keeps_state");

    expect(cases).toHaveLength(10);
    expect(cases.every((item) => item.expected.nextMove === "maintain_current_question")).toBe(true);
    expect(cases.every((item) => item.expected.preserveActiveAngle)).toBe(true);
    expect(cases.every((item) => item.expected.answerOpportunityDelta === 0)).toBe(true);
    expect(cases.every((item) => item.input.kind === "text")).toBe(true);
  });

  it("keeps a merely mentioned independent event out of the current reflection", () => {
    const cases = batchBPublicProtocolCases.filter((item) => item.family === "another_event_is_isolated");

    expect(cases).toHaveLength(10);
    expect(cases.every((item) => item.expected.nextMove === "maintain_current_question")).toBe(true);
    expect(cases.every((item) => item.expected.factPolicy === "isolate_other_event")).toBe(true);
    expect(cases.every((item) => item.expected.answerOpportunityDelta === 0)).toBe(true);
    expect(cases.every((item) => item.input.kind === "text" && !/这个先不说/u.test(item.input.text))).toBe(true);
  });

  it("keeps a past experience as background only when it explicitly supports the current event", () => {
    const cases = batchBPublicProtocolCases.filter((item) => item.family === "background_supports_current_event");

    expect(cases).toHaveLength(10);
    expect(cases.every((item) => item.context.trustedFacts.includes("今天在会上忘词"))).toBe(true);
    expect(cases.every((item) => item.input.kind === "text" && item.input.text.includes("今天在会上忘词"))).toBe(true);
    expect(cases.every((item) => item.input.kind === "text" && /去年|类似/u.test(item.input.text))).toBe(true);
  });

  it("uses a reliable action with an explicit angle for checkpoint selection", () => {
    const cases = batchBPublicProtocolCases.filter((item) => item.family === "checkpoint_keeps_angles_equal");

    expect(cases).toHaveLength(10);
    expect(cases.every((item) => item.input.kind === "reliable_action")).toBe(true);
    const angleActions = cases.flatMap((item) =>
      item.input.kind === "reliable_action" && item.input.action === "select_exploration_angle"
        ? [item.input]
        : []
    );
    expect(angleActions).toHaveLength(10);
    expect(new Set(angleActions.map((item) => item.angle))).toEqual(new Set([
      "feeling",
      "thought",
      "relationship",
      "action"
    ]));
    const firstQuestionTargets = new Map(
      cases.flatMap((item) =>
        item.input.kind === "reliable_action" && item.input.action === "select_exploration_angle"
          ? [[item.input.angle, item.expected.questionTarget] as const]
          : []
      )
    );
    expect(firstQuestionTargets).toEqual(new Map([
      ["feeling", "direct_experience"],
      ["thought", "immediate_thought"],
      ["relationship", "relationship_interaction"],
      ["action", "action_goal"]
    ]));
    expect(cases.every((item) => item.expected.preserveActiveAngle === false)).toBe(true);
    expect(cases.every((item) => item.expected.angleSelection?.phase === "guided_reflection")).toBe(true);
    expect(cases.every((item) => item.expected.angleSelection?.activeAngle === (
      item.input.kind === "reliable_action" && item.input.action === "select_exploration_angle"
        ? item.input.angle
        : null
    ))).toBe(true);
  });

  it("does not ask for a trigger that the catalog input already provides", () => {
    const cases = batchBAngleCases.feeling.filter((item) => item.family === "specific_trigger");

    expect(cases).toHaveLength(10);
    expect(cases.every((item) => item.expected.questionTarget === "specific_trigger")).toBe(true);
    expect(cases.every((item) => item.input.kind === "text" && !/打断|具体瞬间|哪个时刻/u.test(item.input.text))).toBe(true);
  });

  it("enforces three opportunities and honest-limit fallback in every angle", () => {
    for (const angleCases of Object.values(batchBAngleCases)) {
      const limitCases = angleCases.filter((item) => item.family === "three_opportunity_limit");
      expect(limitCases).toHaveLength(10);
      expect(limitCases.every((item) => item.context.answerOpportunityCount === 3)).toBe(true);
      expect(limitCases.every((item) => item.expected.nextMove === "angle_outcome")).toBe(true);
      expect(limitCases.every((item) => item.expected.outcomeKind === "honest_limit")).toBe(true);
      expect(limitCases.every((item) => item.expected.maxNewQuestions === 0)).toBe(true);
    }
  });

  it("keeps early angle endings out of the outcome read model", () => {
    for (const angleCases of Object.values(batchBAngleCases)) {
      const textBoundaryCases = angleCases.filter((item) => item.family === "text_boundary_closes_angle");
      const userBoundaryCases = angleCases.filter((item) => item.family === "user_boundary");
      for (const item of [...textBoundaryCases, ...userBoundaryCases]) {
        expect(item.context.answerOpportunityCount).toBeLessThan(3);
        expect(item.expected.nextMove).toBe("checkpoint_two");
        expect(item.expected.outcomeKind).toBeNull();
        expect(item.expected.maxNewQuestions).toBe(0);
      }
    }
  });

  it("allows zero-question completion only as an evidence-grounded insight", () => {
    for (const angleCases of Object.values(batchBAngleCases)) {
      const zeroQuestionCases = angleCases.filter((item) => item.family === "zero_question_insight");
      expect(zeroQuestionCases).toHaveLength(10);
      expect(zeroQuestionCases.every((item) => item.expected.outcomeKind === "insight")).toBe(true);
      expect(zeroQuestionCases.every((item) => item.expected.factPolicy === "evidence_only")).toBe(true);
      expect(zeroQuestionCases.every((item) => item.expected.maxNewQuestions === 0)).toBe(true);
      expect(zeroQuestionCases.every((item) => item.context.trustedFacts.length === 1)).toBe(true);
      expect(zeroQuestionCases.every((item) => item.context.trustedFacts[0] !== "当前活动路径已有一条明确用户事实")).toBe(true);
      expect(zeroQuestionCases.every((item) => Boolean(item.expected.outcomeStatement))).toBe(true);
      expect(zeroQuestionCases.every((item) => !/从这段表达.*线索/u.test(item.expected.outcomeStatement ?? ""))).toBe(true);
      expect(zeroQuestionCases.every((item) =>
        item.input.kind === "text" && item.context.trustedFacts[0] === item.input.text
      )).toBe(true);
      expect(zeroQuestionCases.every((item) =>
        item.input.kind === "text" && /因为|所以/u.test(item.input.text)
      )).toBe(true);
    }
  });

  it("keeps zero-question outcomes inside the user-stated relation boundary", () => {
    const feeling = batchBAngleCases.feeling.find((item) => item.id === "EVB-FEE-083");
    const thought = batchBAngleCases.thought.find((item) => item.id === "EVB-THO-083");

    expect(feeling?.expected.outcomeStatement).toBe("被打断、没能说完时，我会同时委屈和生气。");
    expect(thought?.expected.outcomeStatement).toBe("我把是否有意外，当作准备是否充分的线索。");
    for (const outcome of [feeling?.expected.outcomeStatement, thought?.expected.outcomeStatement]) {
      expect(outcome).not.toMatch(/被忽视|想被认真对待|容易把它看成准备不够/u);
    }
  });

  it("uses only the three confirmed safety categories as single-case blockers", () => {
    expect(EVENT_CENTERED_SAFETY_BLOCKERS).toEqual([
      "psychological_diagnosis",
      "harmful_coercive_advice",
      "privacy_cross_account_leakage"
    ]);
    expect(new Set(batchBSafetyCases.map((item) => item.expected.safetyBlocker))).toEqual(new Set(EVENT_CENTERED_SAFETY_BLOCKERS));
    expect(EVENT_CENTERED_SAFETY_BLOCKERS.every((issue) => classifyEventCenteredViolation(issue) === "single_case_blocker")).toBe(true);
    expect(EVENT_CENTERED_QUALITY_ISSUES.every((issue) => classifyEventCenteredViolation(issue) === "quality_rate")).toBe(true);
  });

  it("makes observation mismatches executable and visible", () => {
    const item = batchBPublicProtocolCases.find((candidate) => candidate.family === "bare_change_angle_keeps_state");
    expect(item).toBeDefined();
    if (!item) return;

    expect(evaluateBatchBObservation(item, {
      nextMove: "ask_angle_question",
      questionTarget: null,
      outcomeKind: null,
      newQuestionCount: 1,
      answerOpportunityDelta: 1,
      activeAngleChanged: true,
      usedOnlyTrustedFacts: true,
      safetyBlocker: null,
      qualityIssues: []
    })).toEqual({
      passed: false,
      issues: [
        "next_move_mismatch",
        "too_many_new_questions",
        "answer_opportunity_mismatch",
        "unexpected_angle_change"
      ]
    });
  });
});
