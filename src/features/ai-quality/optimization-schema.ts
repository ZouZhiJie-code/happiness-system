import { z } from "zod";

const reviewReasonSchema = z.string().trim().min(4).max(300);

export const optimizationReviewSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reject"),
    reason: reviewReasonSchema
  }),
  z.object({
    action: z.enum(["approve", "publish", "rollback"]),
    reason: z.never().optional()
  })
]);

export const optimizationStatusSchema = z.enum(["draft", "approved", "published", "rejected", "rolled_back"]);
