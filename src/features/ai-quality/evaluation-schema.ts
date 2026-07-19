import { z } from "zod";

export const aiJudgeResultSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  dimensionScores: z.object({
    grounding: z.number().int().min(0).max(100),
    dimensionAlignment: z.number().int().min(0).max(100),
    boundarySafety: z.number().int().min(0).max(100),
    clarity: z.number().int().min(0).max(100),
    completeness: z.number().int().min(0).max(100)
  }),
  deductions: z.array(
    z.object({
      code: z.string().trim().min(1).max(80),
      dimension: z.enum(["grounding", "dimensionAlignment", "boundarySafety", "clarity", "completeness"]),
      points: z.number().int().min(0).max(100),
      severity: z.enum(["minor", "major", "critical"]),
      reason: z.string().trim().min(1).max(300),
      evidence: z.string().trim().max(200).nullable().default(null)
    })
  ).max(12),
  summary: z.string().trim().min(1).max(400),
  confidence: z.number().min(0).max(1)
});

export type AIJudgeResult = z.infer<typeof aiJudgeResultSchema>;
