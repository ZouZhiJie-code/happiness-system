import { z } from "zod";

import {
  EVENT_CENTERED_QUALITY_ISSUES,
  EVENT_CENTERED_SAFETY_BLOCKERS
} from "@/features/interview/event-centered/evaluation-catalog";
import { JOURNAL_EVENT_ANGLES } from "@/types/journal-event-angle-outcome";

const nullableText = z.string().trim().min(1).nullable();

/**
 * Batch B 的回放输入必须区分用户说出的文本与界面已经可靠接收的按钮动作。
 * 文本只能表达内容、纠正、停止或问题修复；阶段与角度切换由动作协议承载。
 */
export const batchBTextInputSchema = z.object({
  kind: z.literal("text"),
  text: z.string().trim().min(1)
}).strict();

export const batchBReliableActionInputSchema = z.discriminatedUnion("action", [
  z.object({
    kind: z.literal("reliable_action"),
    action: z.literal("select_current_event"),
    optionId: z.string().trim().min(1)
  }).strict(),
  z.object({
    kind: z.literal("reliable_action"),
    action: z.literal("select_exploration_angle"),
    angle: z.enum(JOURNAL_EVENT_ANGLES)
  }).strict(),
  z.object({
    kind: z.literal("reliable_action"),
    action: z.literal("continue_exploration")
  }).strict(),
  z.object({
    kind: z.literal("reliable_action"),
    action: z.literal("exit_event")
  }).strict()
]);

export const batchBEvaluationInputSchema = z.union([
  batchBTextInputSchema,
  batchBReliableActionInputSchema
]);

export type BatchBTextInput = z.infer<typeof batchBTextInputSchema>;
export type BatchBReliableActionInput = z.infer<typeof batchBReliableActionInputSchema>;
export type BatchBEvaluationInput = z.infer<typeof batchBEvaluationInputSchema>;

/**
 * 纸笺选择角度后，由可靠动作与确定性策略共同产出的可观察状态。
 * 这部分属于评测目录契约，用于把“选了哪个角度”与实际首问、机会计数连起来。
 */
export const batchBAngleSelectionProjectionSchema = z.object({
  phase: z.literal("guided_reflection"),
  activeAngle: z.enum(JOURNAL_EVENT_ANGLES),
  questionTarget: z.string().trim().min(1),
  answerOpportunityDelta: z.literal(1)
}).strict();

export type BatchBAngleSelectionProjection = z.infer<
  typeof batchBAngleSelectionProjectionSchema
>;

export const batchBReplayObservationSchema = z.object({
  nextMove: z.enum([
    "checkpoint_one",
    "clarify_event",
    "ask_angle_question",
    "repair_question",
    "maintain_current_question",
    "angle_outcome",
    "checkpoint_two",
    "respond_only",
    "block_response"
  ]),
  questionTarget: nullableText,
  outcomeKind: z.enum(["insight", "honest_limit"]).nullable(),
  newQuestionCount: z.union([z.literal(0), z.literal(1)]),
  answerOpportunityDelta: z.union([z.literal(0), z.literal(1)]),
  activeAngleChanged: z.boolean(),
  usedOnlyTrustedFacts: z.boolean(),
  safetyBlocker: z.enum(EVENT_CENTERED_SAFETY_BLOCKERS).nullable(),
  qualityIssues: z.array(z.enum(EVENT_CENTERED_QUALITY_ISSUES)).max(16)
}).strict();

export const batchBModelReplaySchema = z.object({
  observation: batchBReplayObservationSchema,
  naturalUnderstanding: z.string().trim().min(1),
  naturalResponse: z.string().trim().min(1),
  rationale: z.string().trim().min(1)
}).strict();

export const batchBJudgeResultSchema = z.object({
  passed: z.boolean(),
  safetyBlocker: z.enum(EVENT_CENTERED_SAFETY_BLOCKERS).nullable(),
  qualityIssues: z.array(z.enum(EVENT_CENTERED_QUALITY_ISSUES)).max(16),
  reasons: z.array(z.string().trim().min(1)).max(6)
}).strict();

export type BatchBModelReplay = z.infer<typeof batchBModelReplaySchema>;
export type BatchBJudgeResult = z.infer<typeof batchBJudgeResultSchema>;
