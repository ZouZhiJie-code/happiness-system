import { describe, expect, it } from "vitest";

import {
  assessExplicitStopFromControlDecision,
  decideInterviewControlV2,
  INTERVIEW_CONTROL_DECISION_VERSION,
  INTERVIEW_INTENT_CLASSIFIER_VERSION_V2
} from "@/features/interview/intent/control-decision-v2";
import { assessUserTurnIntent } from "@/features/interview/intent/intent-v1";
import { reconcileIntentAssessmentWithControlDecisionV2 } from "@/features/interview/intent/control-decision-v2";

function decide(rawText: string) {
  return decideInterviewControlV2({
    rawText,
    lastAssistantMessage: "你愿意说说当时最费力的是哪一部分吗？",
    currentQuestionTarget: "event_anchor",
    workingTaskRef: "task-1",
    semanticState: { stage: "explore_clarify" }
  });
}

describe("interview control decision v2", () => {
  const matrix = [
    ["跟她解释真的好累，但我还是想让她理解我", "none", "none"],
    ["我不想再跟她解释了，但你可以继续问我", "none", "none"],
    ["我很累，但还想继续聊", "none", "none"],
    ["我回答这些问题真的好累，今天先到这", "stop_follow_up", "mixed"],
    ["我不想生成日志，继续问我", "none", "none"],
    ["妈妈让我把这些写成日志交给老师", "none", "none"],
    ["她说“别问了”", "none", "none"],
    ["她问我为什么辞职，我不想再继续聊了", "stop_follow_up", "mixed"],
    ["先生成日志，算了，继续问我", "none", "none"],
    ["别切到感谢维度", "none", "none"],
    ["我换个角度想", "none", "none"],
    ["我不是不想聊", "none", "none"],
    ["谢谢，不过我还想继续", "none", "none"],
    ["同事主动帮我把项目收尾，我一下松了口气", "none", "none"],
    ["我们今天就收尾吧", "stop_follow_up", "pure"],
    ["谢谢，今天先到这", "stop_follow_up", "pure"]
  ] as const;

  it.each(matrix)("classifies %s", (rawText, action, stopKind) => {
    const result = decide(rawText);
    expect(result.finalAction).toBe(action);
    expect(assessExplicitStopFromControlDecision(result)).toBe(stopKind);
    expect(result.decisionVersion).toBe(INTERVIEW_CONTROL_DECISION_VERSION);
    expect(result.classifierVersion).toBe(
      INTERVIEW_INTENT_CLASSIFIER_VERSION_V2
    );
  });

  it("keeps event fatigue as content and marks it for review without takeover", () => {
    const result = decide("跟奶奶解释很累，但我还是想让她理解我");
    expect(result.finalAction).toBe("none");
    expect(result.programTakeover).toBe(false);
    expect(result.reviewCandidate).toBe(true);
    expect(result.contentEvidenceText).toContain("跟奶奶解释很累");
  });

  it("keeps all candidates and applies the last active command", () => {
    const result = decide("先生成日志，算了，继续问我，最后还是今天先到这");
    expect(result.finalAction).toBe("stop_follow_up");
    expect(result.candidates.map((candidate) => candidate.action)).toEqual([
      "generate_draft",
      "stop_follow_up"
    ]);
    expect(result.candidates[0]).toMatchObject({
      temporalScope: "revoked",
      effective: false
    });
    expect(result.candidates[1]).toMatchObject({
      targetScope: "current_interview",
      speechMode: "user_direct",
      polarity: "affirmative",
      temporalScope: "active",
      effective: true
    });
  });

  it("preserves quoted and reported commands as evidence without execution", () => {
    const quoted = decide("她说“别问了”");
    expect(quoted.candidates[0]).toMatchObject({
      speechMode: "quoted",
      targetScope: "third_party",
      effective: false
    });

    const reported = decide("妈妈让我把这些写成日志交给老师");
    expect(reported.candidates[0]).toMatchObject({
      action: "generate_draft",
      speechMode: "reported",
      targetScope: "third_party",
      effective: false
    });
  });

  it("uses content evidence to distinguish pure and mixed stops", () => {
    expect(decide("谢谢，今天先到这").contentEvidenceText).toBe("");
    expect(decide("我补充一点：她其实是在担心我，今天先到这").contentEvidenceText)
      .toContain("她其实是在担心我");
  });

  it("gives GI-088 and the formal interview adapter the same fatigue decision", () => {
    const rawText = "跟奶奶解释很累，但我还是想让她理解我";
    const decision = decide(rawText);
    const legacy = assessUserTurnIntent({
      rawText,
      lastAssistantQuestion: "你愿意继续说说吗？"
    });
    expect(legacy.primaryControl).toBe("stop_follow_up");
    const formalAssessment = reconcileIntentAssessmentWithControlDecisionV2({
      assessment: legacy,
      decision
    });
    expect(formalAssessment.primaryControl).toBe(decision.finalAction);
    expect(formalAssessment.content.evidenceText).toContain("解释很累");
  });
});
