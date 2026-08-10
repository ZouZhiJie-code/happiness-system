import {
  EVENT_CENTERED_QUALITY_ISSUES,
  EVENT_CENTERED_SAFETY_BLOCKERS,
  batchBAngleCases,
  batchBEvaluationCatalog,
  batchBPublicProtocolCases,
  batchBSafetyCases,
  classifyEventCenteredViolation,
  evaluateBatchBObservation,
  inspectBatchBEvaluationQuestionCase
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

  it("spreads the ten public repair cases across both basic angles and all relationship/action focuses", () => {
    const repairCases = batchBPublicProtocolCases.filter(
      (item) => item.family === "repair_creates_new_answer_opportunity"
    );

    expect(repairCases.map((item) => item.id)).toEqual(
      Array.from(
        { length: 10 },
        (_, index) => `EVB-PUB-${String(81 + index).padStart(3, "0")}`
      )
    );
    expect(repairCases.map((item) => item.context.activeAngle)).toEqual([
      "feeling",
      "thought",
      "relationship",
      "relationship",
      "relationship",
      "relationship",
      "action",
      "action",
      "action",
      "action"
    ]);
    expect(repairCases.slice(2, 6).map((item) => item.context.lastQuestion)).toEqual([
      expect.stringContaining("位置"),
      expect.stringMatching(/信任|可靠/u),
      expect.stringMatching(/来有回|双方/u),
      expect.stringMatching(/界限|边界/u)
    ]);
    expect(repairCases.slice(6).map((item) => item.context.lastQuestion)).toEqual([
      expect.stringMatching(/取舍|两边/u),
      expect.stringMatching(/帮上了忙|起了作用/u),
      expect.stringMatching(/阻力|卡住/u),
      expect.stringMatching(/调整/u)
    ]);
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

  it("keeps every question family on an explicit and self-consistent dialogue path", () => {
    const questionCases = Object.values(batchBAngleCases)
      .flat()
      .filter((item) => item.expected.nextMove === "ask_angle_question");

    expect(questionCases).toHaveLength(240);
    for (const item of questionCases) {
      expect(inspectBatchBEvaluationQuestionCase(item)).toEqual([]);
      expect(item.context.askedTargets).toHaveLength(item.context.answerOpportunityCount);
      expect(item.context.answeredTargets).toHaveLength(
        Math.max(0, item.context.answerOpportunityCount - 1)
      );
    }
  });

  it("uses the second answered opportunity before optional third-layer questions", () => {
    const optionalFamilies = new Set([
      "experience_change",
      "mixed_feeling",
      "body_state",
      "care_need_boundary",
      "default_expectation",
      "evaluation_standard",
      "tradeoff_condition",
      "relational_position",
      "trust_signal",
      "reciprocity",
      "relationship_boundary",
      "tradeoff",
      "effective_condition",
      "resistance",
      "adjustable_part"
    ]);
    const cases = Object.values(batchBAngleCases)
      .flat()
      .filter((item) => optionalFamilies.has(item.family));

    expect(cases).toHaveLength(150);
    expect(cases.every((item) => item.context.answerOpportunityCount === 2)).toBe(true);
    expect(cases.every((item) => item.context.answeredTargets?.length === 1)).toBe(true);
    expect(cases.every((item) => item.context.askedTargets?.length === 2)).toBe(true);
    expect(cases.every((item) =>
      !item.context.askedTargets?.includes(item.expected.questionTarget ?? "")
    )).toBe(true);
  });

  it("keeps trust and action tradeoffs inside the MVP aggregate targets", () => {
    const trustCases = batchBAngleCases.relationship.filter(
      (item) => item.family === "trust_signal"
    );
    const actionTradeoffCases = batchBAngleCases.action.filter(
      (item) => item.family === "tradeoff"
    );

    expect(trustCases).toHaveLength(10);
    expect(actionTradeoffCases).toHaveLength(10);
    expect(trustCases.every(
      (item) => item.expected.questionTarget === "relationship_position_or_boundary"
    )).toBe(true);
    expect(actionTradeoffCases.every(
      (item) => item.expected.questionTarget === "action_condition_or_friction"
    )).toBe(true);
  });

  it("关系第三层四个子题分别保留一个真实缺口，避免前句先给出答案", () => {
    const expectedCueByFamily = {
      relational_position: "还没想清希望自己处在什么位置",
      trust_signal: "还没说清哪种回应最影响信任",
      reciprocity: "还没说清期待彼此怎样投入",
      relationship_boundary: "还没说清哪一条界限最重要"
    } as const;
    const focusCases = batchBAngleCases.relationship.filter(
      (item) => item.family in expectedCueByFamily
    );

    expect(focusCases).toHaveLength(40);
    for (const item of focusCases) {
      if (item.input.kind !== "text") {
        throw new Error(`${item.id} 应为文本输入。`);
      }
      const family = item.family as keyof typeof expectedCueByFamily;
      expect(item.input.text).toContain(expectedCueByFamily[family]);
      expect(item.input.text).not.toMatch(
        /拒绝以后不用反复证明理由|分歧出现时还能把真实想法说出来|这段互动由双方一起推进/u
      );
      expect(item.expected.questionTarget).toBe(
        "relationship_position_or_boundary"
      );
      expect(inspectBatchBEvaluationQuestionCase(item)).toEqual([]);
    }
  });

  it.each([
    ["tradeoff", 21, 30, /取舍.*还没说清取舍的两端/u],
    ["effective_condition", 31, 40, /条件明显帮上了忙.*还没说清/u],
    ["resistance", 41, 50, /具体阻力.*还没说清/u],
    ["adjustable_part", 51, 60, /能调整.*还没说清/u]
  ] as const)(
    "行动 %s 子题只保留一个待回答缺口",
    (family, start, end, unresolvedCue) => {
      const cases = batchBAngleCases.action.filter(
        (item) => item.family === family
      );

      expect(cases.map((item) => Number(item.id.slice(-3)))).toEqual(
        Array.from({ length: end - start + 1 }, (_, index) => start + index)
      );
      expect(cases.every((item) =>
        item.input.kind === "text" &&
        unresolvedCue.test(item.input.text) &&
        item.context.currentQuestionTarget === "action_choice" &&
        item.expected.questionTarget === "action_condition_or_friction" &&
        inspectBatchBEvaluationQuestionCase(item).length === 0
      )).toBe(true);
    }
  );

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

  it("keeps one-off zero-question outcomes scoped to the current event", () => {
    const explicitRepeatEvidence =
      /(?:总是|总会|总想|总在|每次|每回|通常|经常|常常|往往|一贯|一向|反复|容易|只要.{1,24}就|每当.{1,24}就|一(?!开始|上来|度|次)[^，。！？]{1,20}就)/u;
    const currentEventScope =
      /(?:这次|这回|那次|当时|刚才|当天|今天|这件事(?:里|中)|那一刻|这个时刻)/u;
    const unsupportedStablePattern =
      /(?:总是|总会|每次|每回|通常|经常|常常|往往|一贯|反复|我会|我容易|会让我|能让我|会被我|会转成|会一直|会先|会同时|会更|会在意|会用)/u;

    const zeroQuestionCases = Object.values(batchBAngleCases)
      .flat()
      .filter((item) => item.family === "zero_question_insight");

    expect(zeroQuestionCases).toHaveLength(40);
    for (const item of zeroQuestionCases) {
      if (item.input.kind !== "text") {
        throw new Error(`${item.id} 应为文本输入。`);
      }
      const outcome = item.expected.outcomeStatement ?? "";
      if (explicitRepeatEvidence.test(item.input.text)) {
        continue;
      }
      expect(outcome, item.id).toMatch(currentEventScope);
      expect(outcome, item.id).not.toMatch(unsupportedStablePattern);
    }
  });

  it("keeps zero-question outcomes inside the user-stated relation boundary", () => {
    const feelingBody = batchBAngleCases.feeling.find((item) => item.id === "EVB-FEE-082");
    const feelingMixed = batchBAngleCases.feeling.find((item) => item.id === "EVB-FEE-083");
    const feelingExpectation = batchBAngleCases.feeling.find((item) => item.id === "EVB-FEE-084");
    const thought = batchBAngleCases.thought.find((item) => item.id === "EVB-THO-083");
    const action = batchBAngleCases.action.find((item) => item.id === "EVB-ACT-083");

    expect(feelingBody?.expected.outcomeStatement).toBe("这次胸口收紧让我一直屏气，离开现场后才松下来。");
    expect(feelingMixed?.expected.outcomeStatement).toBe("这次被打断、没能说完时，我同时委屈和生气。");
    expect(feelingExpectation?.expected.outcomeStatement).toBe("这次看到那条消息时，原本对好消息的期待落了空。");
    expect(thought?.expected.outcomeStatement).toBe("这次，我把是否有意外，当作准备是否充分的线索。");
    expect(action?.expected.outcomeStatement).toBe("这次有提前留出的半小时，让后面没那么赶。");
    for (const outcome of [
      feelingBody?.expected.outcomeStatement,
      feelingMixed?.expected.outcomeStatement,
      feelingExpectation?.expected.outcomeStatement,
      thought?.expected.outcomeStatement,
      action?.expected.outcomeStatement
    ]) {
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
    expect(EVENT_CENTERED_QUALITY_ISSUES).toContain("third_person_observer_voice");
    expect(EVENT_CENTERED_QUALITY_ISSUES).toContain("first_checkpoint_duplicate_layers");
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
