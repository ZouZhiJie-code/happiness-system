import {
  getAIQualityExpectedImprovement,
  getAIQualityIssueDescription,
  getAIQualityIssueLabel
} from "@/features/ai-quality/issue-presentation";

describe("AI quality issue presentation", () => {
  it("reuses product feedback labels for interview and journal issue codes", () => {
    expect(getAIQualityIssueLabel("user_downvote:repetitive_question", "interview_turn")).toBe("追问重复");
    expect(getAIQualityIssueLabel("too_abstract", "interview_turn")).toBe("问题太抽象");
    expect(getAIQualityIssueLabel("bad_title", "dimension_journal")).toBe("标题不合适");
    expect(getAIQualityIssueLabel("factually_wrong", "interview_turn")).toBe("内容有误或编造");
  });

  it("covers free-text and unknown issues with honest fallback copy", () => {
    expect(getAIQualityIssueLabel("user_downvote:free_text", "interview_turn")).toBe("补充文字反馈");
    expect(getAIQualityIssueDescription("user_downvote:free_text")).toContain("原对话");
    expect(getAIQualityIssueLabel("unseen_quality_alpha")).toBe("其他质量问题");
    expect(getAIQualityExpectedImprovement("unseen_quality_alpha")).toContain("这一具体问题");
  });
});
