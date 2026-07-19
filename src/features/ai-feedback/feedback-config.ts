import type { AIGenerationArtifactType } from "@prisma/client";
import { z } from "zod";

export const CURRENT_PRIVACY_POLICY_VERSION = "2026-07-19";

export const AI_FEEDBACK_TAGS = {
  interview_turn: [
    { code: "misunderstood", label: "没理解我的意思" },
    { code: "repetitive_question", label: "追问重复" },
    { code: "too_abstract", label: "问题太抽象" },
    { code: "ignored_boundary", label: "忽视停止或边界" },
    { code: "tone_uncomfortable", label: "语气让我不舒服" },
    { code: "factually_wrong", label: "内容有误或编造" }
  ],
  dimension_journal: [
    { code: "missing_key_detail", label: "遗漏重要内容" },
    { code: "hallucinated_detail", label: "写了我没说的" },
    { code: "dimension_mismatch", label: "偏离这个维度" },
    { code: "voice_mismatch", label: "文风不像我" },
    { code: "awkward_writing", label: "结构或表达不自然" },
    { code: "bad_title", label: "标题不合适" }
  ]
} as const satisfies Record<AIGenerationArtifactType, ReadonlyArray<{ code: string; label: string }>>;

export const AI_POSITIVE_FEEDBACK_TAGS = {
  interview_turn: [
    { code: "understood_accurately", label: "理解准确" },
    { code: "appropriate_followup", label: "追问合适" },
    { code: "easy_to_answer", label: "具体好答" },
    { code: "respected_pace", label: "尊重节奏" },
    { code: "comfortable_tone", label: "语气舒服" },
    { code: "insightful", label: "带来启发" }
  ],
  dimension_journal: [
    { code: "complete_content", label: "内容完整" },
    { code: "faithful_to_intent", label: "忠于原意" },
    { code: "dimension_aligned", label: "维度贴合" },
    { code: "matches_my_voice", label: "文风像我" },
    { code: "natural_structure", label: "结构自然" },
    { code: "appropriate_title", label: "标题合适" }
  ]
} as const satisfies Record<AIGenerationArtifactType, ReadonlyArray<{ code: string; label: string }>>;

export const feedbackSubmissionSchema = z
  .object({
    vote: z.enum(["upvote", "downvote"]),
    tags: z.array(z.string().trim().min(1).max(64)).max(6).default([]),
    comment: z.string().trim().max(1000).nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.vote === "downvote" && value.tags.length === 0 && !value.comment) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["tags"], message: "DOWNVOTE_DETAIL_REQUIRED" });
    }
  });

export const aiQualityConsentSchema = z.object({
  participate: z.boolean()
});

export function getFeedbackTags(artifactType: AIGenerationArtifactType, vote: "upvote" | "downvote") {
  return vote === "upvote" ? AI_POSITIVE_FEEDBACK_TAGS[artifactType] : AI_FEEDBACK_TAGS[artifactType];
}

export function hasCurrentAIQualityConsent(user: {
  aiQualityConsentVersion: string | null;
  aiQualityConsentAt: Date | null;
  aiQualityConsentRevokedAt: Date | null;
}) {
  return (
    user.aiQualityConsentVersion === CURRENT_PRIVACY_POLICY_VERSION &&
    Boolean(user.aiQualityConsentAt) &&
    !user.aiQualityConsentRevokedAt
  );
}
