import {
  assessUserTurnIntent,
  decideUserTurn,
  intentAssessmentV1Schema,
  mergeIntentAssessments,
  toLegacyUserTurnAssessment
} from "@/features/interview/intent/intent-v1";
import type { AssistantQuestionSpec } from "@/types/interview";
import {
  createIntentAwareExtractResultSchema,
  fulfillmentExtractResultSchema,
  gratitudeExtractResultSchema,
  improvementExtractResultSchema,
  joyExtractResultSchema
} from "@/features/joy-interview/schema/joy-ai.schema";

function questionSpec(
  target: AssistantQuestionSpec["target"],
  overrides: Partial<AssistantQuestionSpec> = {}
): AssistantQuestionSpec {
  return {
    target,
    stageIntent: "advance",
    surfaceLevel: "default",
    repairCount: 0,
    ...overrides
  };
}

describe("interview intent v1", () => {
  it("keeps a pure draft command out of evidence extraction", () => {
    const assessment = assessUserTurnIntent({
      rawText: "直接生成日志吧",
      lastAssistantQuestion: "为什么重要？",
      questionSpec: questionSpec("insight_evidence")
    });

    expect(assessment).toMatchObject({
      primaryControl: "generate_draft",
      content: {
        presence: "none",
        evidenceText: null
      }
    });
    expect(decideUserTurn(assessment).runExtraction).toBe(false);
  });

  it("keeps a polite full-sentence draft command out of evidence extraction", () => {
    const assessment = assessUserTurnIntent({
      rawText: "麻烦把刚才的内容整理成一版文字吧",
      lastAssistantQuestion: "为什么这件事让你觉得值得珍惜？",
      questionSpec: questionSpec("judgment_clue", {
        subTarget: "gratitude_reason"
      })
    });

    expect(assessment).toMatchObject({
      primaryControl: "generate_draft",
      dialogueActs: [],
      content: {
        presence: "none",
        evidenceText: null,
        answeredTarget: null
      }
    });
    expect(decideUserTurn(assessment).runExtraction).toBe(false);
  });

  it("treats a pure concrete-wording request as question repair", () => {
    const assessment = assessUserTurnIntent({
      rawText: "这个问题能问得落地一点吗",
      lastAssistantQuestion: "这件事对你的深层意义是什么？",
      questionSpec: questionSpec("judgment_clue")
    });

    expect(assessment).toMatchObject({
      primaryControl: "repair_question",
      dialogueActs: [],
      content: {
        presence: "none",
        evidenceText: null,
        answeredTarget: null
      }
    });
    expect(decideUserTurn(assessment)).toMatchObject({
      runExtraction: false,
      advanceTurn: false,
      nextAction: "repair_question",
      nextQuestionStyle: "simplified"
    });
  });

  it.each([
    ["妈妈", "谁在那个时刻帮了你？", "event_anchor"],
    ["委屈", "那一刻你心里是什么感受？", "reaction_evidence"],
    ["没有", "当时有具体对话吗？", "event_anchor"],
    ["算是", "这算是一种被理解的感觉吗？", "insight_evidence"]
  ] as const)("treats contextual short answer %s as clear content", (rawText, question, target) => {
    const assessment = assessUserTurnIntent({
      rawText,
      lastAssistantQuestion: question,
      questionSpec: questionSpec(target)
    });
    const decision = decideUserTurn(assessment);

    expect(assessment.content.presence).toBe("clear");
    expect(assessment.reasonCodes).toContain("contextual_short_answer");
    expect(decision).toMatchObject({
      runExtraction: true,
      advanceTurn: true,
      advanceRound: true
    });
  });

  it.each(["我想说的是……", "我觉得就是……", "可能就是……"])(
    "keeps incomplete utterance %s open without recording usable evidence",
    (rawText) => {
      const assessment = assessUserTurnIntent({
        rawText,
        lastAssistantQuestion: "你最想珍惜的是这段关系里的什么？",
        questionSpec: questionSpec("judgment_clue", {
          subTarget: "relationship_signal"
        })
      });

      expect(assessment).toMatchObject({
        primaryControl: "none",
        dialogueActs: rawText.startsWith("可能")
          ? ["express_uncertainty"]
          : [],
        content: {
          presence: "possible",
          evidenceText: null,
          answeredTarget: null
        }
      });
      expect(assessment.reasonCodes).toContain("incomplete_utterance");
      expect(decideUserTurn(assessment)).toMatchObject({
        runExtraction: false,
        advanceTurn: false,
        advanceRound: false,
        stopFollowUp: false,
        nextAction: "continue_interview"
      });
    }
  );

  it("records a direct negative answer as explicit absence", () => {
    const assessment = assessUserTurnIntent({
      rawText: "没有",
      lastAssistantQuestion: "当时有具体对话吗？",
      questionSpec: questionSpec("event_anchor")
    });

    expect(assessment.content).toMatchObject({
      presence: "clear",
      explicitAbsence: true,
      answeredTarget: "event_anchor"
    });
    expect(assessment.dialogueActs).toContain("deny_hypothesis");
  });

  it.each([
    ["被理解很重要，直接生成吧", "generate_draft", "被理解很重要"],
    ["今天同事帮我改完方案，先别问了", "stop_follow_up", "今天同事帮我改完方案"]
  ] as const)("keeps evidence in mixed control input %s", (rawText, control, evidenceText) => {
    const assessment = assessUserTurnIntent({
      rawText,
      lastAssistantQuestion: "为什么这件事对你重要？",
      questionSpec: questionSpec("insight_evidence")
    });
    const decision = decideUserTurn(assessment);

    expect(assessment.primaryControl).toBe(control);
    expect(assessment.content.presence).toBe("clear");
    expect(assessment.content.evidenceText).toContain(evidenceText);
    expect(decision).toMatchObject({
      runExtraction: true,
      stopFollowUp: true,
      nextAction: "validate_and_wrap_up"
    });
  });

  it.each([
    "同事骂我有病，我很难受",
    "我问他“什么意思”，他一直没回答",
    "今天项目结束了，终于可以休息一下"
  ])("keeps quoted or event language on the content path: %s", (rawText) => {
    const assessment = assessUserTurnIntent({
      rawText,
      lastAssistantQuestion: "当时发生了什么？",
      questionSpec: questionSpec("event_anchor")
    });

    expect(assessment.primaryControl).toBe("none");
    expect(assessment.content.presence).toBe("clear");
    expect(decideUserTurn(assessment).runExtraction).toBe(true);
  });

  it("treats a direct hostile stop as a pure boundary", () => {
    const assessment = assessUserTurnIntent({
      rawText: "你有病吧，别再问了",
      lastAssistantQuestion: "还有什么细节？",
      questionSpec: questionSpec("event_anchor")
    });

    expect(assessment).toMatchObject({
      primaryControl: "stop_follow_up",
      frustration: "strong",
      content: {
        presence: "none"
      }
    });
    expect(decideUserTurn(assessment).runExtraction).toBe(false);
  });

  it("removes every hostile control phrase from a direct stop", () => {
    const assessment = assessUserTurnIntent({
      rawText: "你这问的什么东西，别再追着问了",
      lastAssistantQuestion: "还有什么细节？",
      questionSpec: questionSpec("event_anchor")
    });

    expect(assessment).toMatchObject({
      primaryControl: "stop_follow_up",
      dialogueActs: ["give_feedback"],
      frustration: "strong",
      content: {
        presence: "none",
        evidenceText: null
      }
    });
    expect(assessment.reasonCodes).toEqual(
      expect.arrayContaining(["direct_hostility", "conversation_feedback"])
    );
    expect(decideUserTurn(assessment).runExtraction).toBe(false);
  });

  it("routes repeated-question feedback to a new angle", () => {
    const assessment = assessUserTurnIntent({
      rawText: "这个问题你已经反复问了",
      lastAssistantQuestion: "当时发生了什么？",
      questionSpec: questionSpec("event_anchor")
    });
    const decision = decideUserTurn(assessment);

    expect(assessment.dialogueActs).toContain("give_feedback");
    expect(assessment.primaryControl).toBe("repair_question");
    expect(decision.nextQuestionStyle).toBe("new_angle");
  });

  it("points an explicit event switch at the current event", () => {
    const assessment = assessUserTurnIntent({
      rawText: "我们换到另一件事情",
      lastAssistantQuestion: "这个开心片段还有什么细节？",
      questionSpec: questionSpec("event_anchor")
    });

    expect(assessment).toMatchObject({
      primaryControl: "switch_event",
      referenceTarget: "current_event",
      content: {
        presence: "none"
      }
    });
  });

  it("keeps forced-answer wording as strong feedback and a stop boundary", () => {
    const assessment = assessUserTurnIntent({
      rawText: "别再逼着我回答了",
      lastAssistantQuestion: "下次你准备怎样调整？",
      questionSpec: questionSpec("judgment_clue")
    });

    expect(assessment).toMatchObject({
      primaryControl: "stop_follow_up",
      dialogueActs: ["give_feedback"],
      frustration: "strong",
      content: {
        presence: "none"
      }
    });
    expect(assessment.reasonCodes).toEqual(
      expect.arrayContaining(["direct_hostility", "conversation_feedback"])
    );
  });

  it("keeps question-pressure feedback and a continued answer on the content path", () => {
    const assessment = assessUserTurnIntent({
      rawText: "这个问题让我有点压力，不过我想说的是，我最在意的是被尊重",
      lastAssistantQuestion: "这件事真正改变了你的什么判断？",
      questionSpec: questionSpec("judgment_clue")
    });
    const decision = decideUserTurn(assessment);

    expect(assessment).toMatchObject({
      primaryControl: "none",
      dialogueActs: expect.arrayContaining(["provide_content", "give_feedback"]),
      content: {
        presence: "clear",
        answeredTarget: "judgment_clue"
      },
      referenceTarget: "current_question",
      frustration: "mild"
    });
    expect(assessment.content.evidenceText).toContain("我最在意的是被尊重");
    expect(decision).toMatchObject({
      runExtraction: true,
      advanceTurn: true,
      stopFollowUp: false,
      nextAction: "continue_interview",
      nextQuestionStyle: "new_angle"
    });
  });

  it("treats low energy as mild interaction pressure and wraps up", () => {
    const assessment = assessUserTurnIntent({
      rawText: "今天确实没什么力气继续",
      lastAssistantQuestion: "你还能再提炼一个值得感标准吗？",
      questionSpec: questionSpec("judgment_clue")
    });

    expect(assessment).toMatchObject({
      primaryControl: "stop_follow_up",
      dialogueActs: ["give_feedback"],
      frustration: "mild",
      referenceTarget: "session"
    });
  });

  it("keeps high-impact LLM controls behind deterministic candidates", () => {
    const deterministic = assessUserTurnIntent({
      rawText: "今天项目结束了，终于松了口气",
      lastAssistantQuestion: "发生了什么？",
      questionSpec: questionSpec("event_anchor")
    });
    const llm = intentAssessmentV1Schema.parse({
      ...deterministic,
      primaryControl: "stop_follow_up",
      controlSignals: ["stop_follow_up"],
      confidence: 0.99,
      origin: "llm",
      reasonCodes: ["llm_stop"]
    });
    const merged = mergeIntentAssessments({
      rawText: "今天项目结束了，终于松了口气",
      deterministic,
      llm
    });

    expect(merged.primaryControl).toBe("none");
    expect(merged.controlSignals).toEqual([]);
  });

  it("keeps the question target when LLM returns a generic answer target", () => {
    const deterministic = assessUserTurnIntent({
      rawText: "完全没有过",
      lastAssistantQuestion: "当时真的有一段具体对话吗？",
      questionSpec: questionSpec("event_anchor")
    });
    const llm = intentAssessmentV1Schema.parse({
      ...deterministic,
      content: {
        ...deterministic.content,
        answeredTarget: "current_question"
      },
      confidence: 0.96,
      origin: "llm",
      reasonCodes: []
    });

    const merged = mergeIntentAssessments({
      rawText: "完全没有过",
      deterministic,
      llm
    });

    expect(merged.content.answeredTarget).toBe("event_anchor");
    expect(merged.content.explicitAbsence).toBe(true);
  });

  it("lets the semantic assessment reject an unsupported current answer target", () => {
    const rawText = "让我满足的是终于推进了一小步，按这些出一份记录吧";
    const deterministic = assessUserTurnIntent({
      rawText,
      lastAssistantQuestion: "她的回应为什么让你珍惜？",
      questionSpec: questionSpec("judgment_clue", {
        subTarget: "gratitude_reason"
      })
    });
    const llm = intentAssessmentV1Schema.parse({
      ...deterministic,
      content: {
        ...deterministic.content,
        evidenceText: "让我满足的是终于推进了一小步",
        answeredTarget: null
      },
      confidence: 0.96,
      origin: "llm",
      reasonCodes: ["semantic_target_mismatch"]
    });

    const merged = mergeIntentAssessments({ rawText, deterministic, llm });

    expect(merged.content).toMatchObject({
      presence: "clear",
      evidenceText: "让我满足的是终于推进了一小步",
      answeredTarget: null
    });
    expect(merged.reasonCodes).toContain("answer_target_not_supported");
  });

  it("keeps the standard target when a model returns null without a semantic mismatch", () => {
    const rawText = "我明白了，核心是被尊重，现在可以整理了";
    const deterministic = assessUserTurnIntent({
      rawText,
      lastAssistantQuestion: "这份开心真正打动你的是什么？",
      questionSpec: questionSpec("judgment_clue")
    });
    expect(deterministic.reasonCodes).toContain("explicit_answer_frame");
    const llm = intentAssessmentV1Schema.parse({
      ...deterministic,
      content: {
        ...deterministic.content,
        evidenceText: "核心是被尊重",
        answeredTarget: null
      },
      confidence: 0.96,
      origin: "llm",
      reasonCodes: []
    });

    const merged = mergeIntentAssessments({ rawText, deterministic, llm });

    expect(merged.content.answeredTarget).toBe("judgment_clue");
    expect(merged.reasonCodes).not.toContain("answer_target_not_supported");
  });

  it("keeps all user-provided event facts when the model shortens normal evidence", () => {
    const rawText = "她说‘别再硬撑了，我来接你’，那一刻我特别感动";
    const deterministic = assessUserTurnIntent({
      rawText,
      lastAssistantQuestion: "她当时具体做了什么让你觉得被照顾？",
      questionSpec: questionSpec("event_anchor", {
        subTarget: "kind_action"
      })
    });
    const llm = intentAssessmentV1Schema.parse({
      ...deterministic,
      content: {
        ...deterministic.content,
        evidenceText: "她说‘别再硬撑了，我来接你’"
      },
      confidence: 0.96,
      origin: "llm",
      reasonCodes: []
    });

    const merged = mergeIntentAssessments({ rawText, deterministic, llm });

    expect(merged.content.evidenceText).toBe(rawText);
    expect(merged.content.answeredTarget).toBe("kind_action");
  });

  it("recognizes a direct correction of the current hypothesis", () => {
    const assessment = assessUserTurnIntent({
      rawText: "刚才说错了，更准确地说，是我总怕让别人失望",
      lastAssistantQuestion: "所以主要是准备不足吗？",
      questionSpec: questionSpec("prior_assumption")
    });

    expect(assessment.dialogueActs).toEqual(
      expect.arrayContaining([
        "provide_content",
        "correct_previous",
        "deny_hypothesis"
      ])
    );
    expect(assessment.referenceTarget).toBe("previous_interpretation");
  });

  it("keeps deterministic control references and filters unsupported feedback", () => {
    const rawText = "我下次先确认优先级，这轮先打住吧";
    const deterministic = assessUserTurnIntent({
      rawText,
      lastAssistantQuestion: "下一次你最想调整哪个小地方？",
      questionSpec: questionSpec("judgment_clue")
    });
    const llm = intentAssessmentV1Schema.parse({
      ...deterministic,
      dialogueActs: ["provide_content", "give_feedback"],
      referenceTarget: "current_event",
      confidence: 0.96,
      origin: "llm"
    });

    const merged = mergeIntentAssessments({ rawText, deterministic, llm });

    expect(merged.referenceTarget).toBe("session");
    expect(merged.dialogueActs).toEqual(["provide_content"]);
  });

  it("removes provide-content after semantic reconciliation produces no content", () => {
    const rawText = "麻烦把刚才的内容整理成一版文字吧";
    const deterministic = assessUserTurnIntent({
      rawText,
      lastAssistantQuestion: "她的回应为什么让你珍惜？",
      questionSpec: questionSpec("judgment_clue", {
        subTarget: "gratitude_reason"
      })
    });
    const llm = intentAssessmentV1Schema.parse({
      ...deterministic,
      dialogueActs: ["provide_content"],
      content: {
        presence: "none",
        evidenceText: null,
        explicitAbsence: false,
        answeredTarget: null
      },
      confidence: 0.96,
      origin: "llm",
      reasonCodes: []
    });

    const merged = mergeIntentAssessments({ rawText, deterministic, llm });

    expect(merged.content.presence).toBe("none");
    expect(merged.dialogueActs).not.toContain("provide_content");
  });

  it("maps v1 assessment back to the legacy service contract", () => {
    const assessment = assessUserTurnIntent({
      rawText: "被理解很重要，直接生成吧",
      lastAssistantQuestion: "为什么重要？",
      questionSpec: questionSpec("insight_evidence")
    });
    const decision = decideUserTurn(assessment);

    expect(toLegacyUserTurnAssessment("被理解很重要，直接生成吧", assessment, decision)).toMatchObject({
      intent: "draft_request",
      isMeaningful: true,
      shouldExtractSnapshot: true,
      shouldAdvanceTurn: true
    });
  });

  it.each([
    ["joy", joyExtractResultSchema],
    ["fulfillment", fulfillmentExtractResultSchema],
    ["reflection", fulfillmentExtractResultSchema],
    ["improvement", improvementExtractResultSchema],
    ["gratitude", gratitudeExtractResultSchema]
  ] as const)("parses the combined %s intent and evidence envelope", (_dimension, evidenceSchema) => {
    const deterministic = assessUserTurnIntent({
      rawText: "今天有一个具体片段",
      lastAssistantQuestion: "发生了什么？",
      questionSpec: questionSpec("event_anchor")
    });
    const intent = {
      ...deterministic,
      origin: "llm" as const
    };

    expect(
      createIntentAwareExtractResultSchema(evidenceSchema).parse({
        intent,
        evidence: {
          tags: []
        }
      })
    ).toMatchObject({
      intent: {
        version: "interview-intent-v1"
      },
      evidence: {
        tags: []
      }
    });
  });
});
