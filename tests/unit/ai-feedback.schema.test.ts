import { AI_FEEDBACK_TAGS, AI_POSITIVE_FEEDBACK_TAGS, feedbackSubmissionSchema } from "@/features/ai-feedback/feedback-config";

describe("AI feedback schema", () => {
  it("keeps six relevant downvote labels for each supported artifact", () => {
    expect(AI_FEEDBACK_TAGS.interview_turn).toHaveLength(6);
    expect(AI_FEEDBACK_TAGS.dimension_journal).toHaveLength(6);
    expect(AI_POSITIVE_FEEDBACK_TAGS.interview_turn).toHaveLength(6);
    expect(AI_POSITIVE_FEEDBACK_TAGS.dimension_journal).toHaveLength(6);
  });

  it("allows a plain upvote and requires details for a downvote", () => {
    expect(feedbackSubmissionSchema.safeParse({ vote: "upvote", tags: [] }).success).toBe(true);
    expect(feedbackSubmissionSchema.safeParse({ vote: "upvote", tags: ["understood_accurately"] }).success).toBe(true);
    expect(feedbackSubmissionSchema.safeParse({ vote: "downvote", tags: [], comment: "" }).success).toBe(false);
    expect(
      feedbackSubmissionSchema.safeParse({ vote: "downvote", tags: ["too_abstract"], comment: "" }).success
    ).toBe(true);
  });

  it("caps free-text feedback at 1000 characters", () => {
    expect(
      feedbackSubmissionSchema.safeParse({ vote: "downvote", tags: [], comment: "问".repeat(1001) }).success
    ).toBe(false);
  });
});
