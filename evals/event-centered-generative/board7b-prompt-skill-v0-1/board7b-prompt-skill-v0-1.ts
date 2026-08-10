import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import {
  BOARD7B_PROMPT_SKILL_V0_VALIDATION_RULES,
  applyBoard7bPromptSkillV0SemanticResult,
  board7bPromptSkillV0OutputSchema,
  board7bPromptSkillV0TurnInputSchema,
  createBoard7bPromptSkillV0UserPrompt,
  parseBoard7bPromptSkillV0Output,
  validateBoard7bPromptSkillV0Output,
  validateBoard7bPromptSkillV0TurnInput,
  type Board7bPromptSkillV0Output,
  type Board7bPromptSkillV0SemanticState,
  type Board7bPromptSkillV0TurnInput
} from "../board7b-prompt-skill-v0/board7b-prompt-skill-v0";

export const BOARD7B_PROMPT_SKILL_V0_1_EVALUATION_ID =
  "board7b_prompt_skill_v0_1" as const;
export const BOARD7B_PROMPT_SKILL_V0_1_DECISION_ID = "GI-084" as const;
export const BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION =
  "2026-08-07.board7b-prompt-skill-v0.1" as const;
export const BOARD7B_PROMPT_SKILL_V0_1_PACKAGE_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.1" as const;
export const BOARD7B_PROMPT_SKILL_V0_1_LOCAL_RUNTIME_DIRECTORY =
  "artifacts/local-runtime/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.1" as const;
export const BOARD7B_PROMPT_SKILL_V0_1_FIXED_OPENING =
  "此刻你想聊点什么？" as const;

export const BOARD7B_PROMPT_SKILL_V0_1_PROMPT_VERSIONS = {
  basePrompt: "2026-08-07.board7b-base-prompt-v0.1",
  interviewSkill: "2026-08-07.board7b-interview-skill-v0.1",
  outputContract: "2026-08-07.board7b-semantic-result-v0",
  turnInput: "2026-08-07.board7b-turn-input-v0"
} as const;

export const BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG = {
  provider: "openai",
  baseUrlHost: "api.deepseek.com",
  model: "deepseek-v4-flash",
  temperature: 0.2,
  maxTokens: 1_800,
  timeoutMs: 30_000,
  responseFormat: "json_object",
  thinking: "disabled",
  callsPerUserTurn: 1,
  qualityRetries: 0,
  automaticTechnicalRetries: 0,
  regressionCallBudget: 8
} as const;

export const BOARD7B_PROMPT_SKILL_V0_1_APPROVAL_VERSION =
  "2026-08-07.board7b-prompt-skill-ui-approval-v0.1" as const;
export const BOARD7B_PROMPT_SKILL_V0_1_APPROVAL_SCOPE =
  "one_direct_interactive_accompany_chat_trajectory_until_user_end" as const;

export const BOARD7B_PROMPT_SKILL_V0_1_VALIDATION_RULES = [
  ...BOARD7B_PROMPT_SKILL_V0_VALIDATION_RULES.filter(
    (rule) => rule !== "workbench_read_only_and_zero_model_calls"
  ),
  "program_does_not_force_deepening_by_turn_count",
  "one_user_submission_one_generation_request",
  "technical_retry_requires_manual_action",
  "quality_retry_disabled",
  "completed_trajectory_is_terminal",
  "rule_coverage_asset_excluded_from_model_prompt"
] as const;

export const board7bPromptSkillV01TurnInputSchema =
  board7bPromptSkillV0TurnInputSchema;
export const board7bPromptSkillV01OutputSchema =
  board7bPromptSkillV0OutputSchema;
export type Board7bPromptSkillV01TurnInput = Board7bPromptSkillV0TurnInput;
export type Board7bPromptSkillV01Output = Board7bPromptSkillV0Output;
export type Board7bPromptSkillV01SemanticState =
  Board7bPromptSkillV0SemanticState;

export type Board7bPromptSkillV01Assets = {
  basePrompt: string;
  interviewSkill: string;
  interviewSkillSource: string;
  outputContract: string;
  systemPrompt: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stripYamlFrontmatter(source: string) {
  const trimmed = source.trim();
  if (!trimmed.startsWith("---\n")) return trimmed;
  const closingIndex = trimmed.indexOf("\n---\n", 4);
  if (closingIndex < 0) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_1_SKILL_FRONTMATTER_INVALID");
  }
  return trimmed.slice(closingIndex + 5).trim();
}

export async function loadBoard7bPromptSkillV01Assets(
  workspaceRoot = process.cwd()
): Promise<Board7bPromptSkillV01Assets> {
  const packageDirectory = resolve(
    workspaceRoot,
    BOARD7B_PROMPT_SKILL_V0_1_PACKAGE_DIRECTORY
  );
  const [basePrompt, interviewSkillSource, outputContract] = await Promise.all([
    readFile(resolve(packageDirectory, "board7b-base-prompt-v0.1.md"), "utf8"),
    readFile(
      resolve(
        packageDirectory,
        "conduct-daily-light-thinking-interview/SKILL.md"
      ),
      "utf8"
    ),
    readFile(resolve(packageDirectory, "board7b-semantic-result-v0.md"), "utf8")
  ]);
  const interviewSkill = stripYamlFrontmatter(interviewSkillSource);
  const normalized = {
    basePrompt: basePrompt.trim(),
    interviewSkill,
    interviewSkillSource: interviewSkillSource.trim(),
    outputContract: outputContract.trim()
  };
  return {
    ...normalized,
    systemPrompt: [
      normalized.basePrompt,
      normalized.interviewSkill,
      normalized.outputContract
    ].join("\n\n")
  };
}

export function createBoard7bPromptSkillV01SystemPrompt(
  assets: Board7bPromptSkillV01Assets
) {
  return assets.systemPrompt;
}

export function createBoard7bPromptSkillV01CandidateFingerprint(
  assets: Board7bPromptSkillV01Assets
) {
  return sha256(
    JSON.stringify({
      evaluationId: BOARD7B_PROMPT_SKILL_V0_1_EVALUATION_ID,
      decisionId: BOARD7B_PROMPT_SKILL_V0_1_DECISION_ID,
      candidateVersion: BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION,
      promptVersions: BOARD7B_PROMPT_SKILL_V0_1_PROMPT_VERSIONS,
      runtimeConfig: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG,
      basePrompt: assets.basePrompt,
      interviewSkillSource: assets.interviewSkillSource,
      interviewSkillRuntimeBody: assets.interviewSkill,
      outputContract: assets.outputContract,
      validationRules: BOARD7B_PROMPT_SKILL_V0_1_VALIDATION_RULES
    })
  );
}

export function createBoard7bPromptSkillV01InitialSemanticState(): Board7bPromptSkillV01SemanticState {
  return {
    stage: "engage_focus",
    focus: null,
    understandings: [],
    openParts: [],
    invalidatedItems: [],
    importantBranches: [],
    burdenSignal: null,
    answerOpportunities: {
      currentFocusStateId: null,
      ledgers: []
    }
  };
}

export const validateBoard7bPromptSkillV01TurnInput =
  validateBoard7bPromptSkillV0TurnInput;
export const createBoard7bPromptSkillV01UserPrompt =
  createBoard7bPromptSkillV0UserPrompt;
export const parseBoard7bPromptSkillV01Output =
  parseBoard7bPromptSkillV0Output;
export const validateBoard7bPromptSkillV01Output =
  validateBoard7bPromptSkillV0Output;
export const applyBoard7bPromptSkillV01SemanticResult =
  applyBoard7bPromptSkillV0SemanticResult;

export function renderBoard7bPromptSkillV01Visible(
  output: Board7bPromptSkillV01Output
) {
  return [output.visible.understanding, output.visible.response]
    .filter(Boolean)
    .join("\n\n");
}

export const board7bPromptSkillV01StartApprovalSchema = z.object({
  approvalType: z.literal(BOARD7B_PROMPT_SKILL_V0_1_EVALUATION_ID),
  approvalVersion: z.literal(BOARD7B_PROMPT_SKILL_V0_1_APPROVAL_VERSION),
  decision: z.literal("approved"),
  approvedBy: z.literal("product_owner_ui"),
  approvedAt: z.string().datetime(),
  candidateFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  trajectoryId: z.string().uuid(),
  approvalScope: z.literal(BOARD7B_PROMPT_SKILL_V0_1_APPROVAL_SCOPE)
});

export type Board7bPromptSkillV01StartApproval = z.infer<
  typeof board7bPromptSkillV01StartApprovalSchema
>;

export function createBoard7bPromptSkillV01RunFingerprint(
  approval: Board7bPromptSkillV01StartApproval
) {
  return sha256(
    JSON.stringify({
      candidateFingerprint: approval.candidateFingerprint,
      trajectoryId: approval.trajectoryId,
      approvalScope: approval.approvalScope
    })
  );
}

export const board7bPromptSkillV01EndSchema = z.object({
  feeling: z.enum(["better", "same", "worse"]),
  reason: z.string().trim().max(2_000).nullable().default(null)
});

export type Board7bPromptSkillV01EndDecision = z.infer<
  typeof board7bPromptSkillV01EndSchema
>;
