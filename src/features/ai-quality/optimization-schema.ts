import { z } from "zod";

export const optimizationReviewSchema = z.object({
  action: z.enum(["approve", "reject", "publish", "rollback"])
});

export const optimizationStatusSchema = z.enum(["draft", "approved", "published", "rejected", "rolled_back"]);
