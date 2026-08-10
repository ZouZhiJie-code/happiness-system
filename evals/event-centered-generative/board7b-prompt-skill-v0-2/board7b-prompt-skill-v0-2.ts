import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG,
  BOARD7B_PROMPT_SKILL_V0_1_VALIDATION_RULES,
  applyBoard7bPromptSkillV01SemanticResult,
  board7bPromptSkillV01OutputSchema,
  board7bPromptSkillV01TurnInputSchema,
  createBoard7bPromptSkillV01InitialSemanticState,
  createBoard7bPromptSkillV01UserPrompt,
  parseBoard7bPromptSkillV01Output,
  renderBoard7bPromptSkillV01Visible,
  validateBoard7bPromptSkillV01Output,
  validateBoard7bPromptSkillV01TurnInput,
  type Board7bPromptSkillV01Output,
  type Board7bPromptSkillV01SemanticState,
  type Board7bPromptSkillV01TurnInput
} from "../board7b-prompt-skill-v0-1/board7b-prompt-skill-v0-1";

export const BOARD7B_PROMPT_SKILL_V0_2_EVALUATION_ID =
  "board7b_prompt_skill_v0_2" as const;
export const BOARD7B_PROMPT_SKILL_V0_2_DECISION_ID = "GI-084" as const;
export const BOARD7B_PROMPT_SKILL_V0_2_CANDIDATE_VERSION =
  "2026-08-07.board7b-prompt-skill-v0.2" as const;
export const BOARD7B_PROMPT_SKILL_V0_2_PACKAGE_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.2" as const;

export const BOARD7B_PROMPT_SKILL_V0_2_PROMPT_VERSIONS = {
  basePrompt: "2026-08-07.board7b-base-prompt-v0.1",
  interviewSkill: "2026-08-07.board7b-interview-skill-v0.2",
  outputContract: "2026-08-07.board7b-semantic-result-v0.1",
  turnInput: "2026-08-07.board7b-turn-input-v0"
} as const;

export const BOARD7B_PROMPT_SKILL_V0_2_RUNTIME_CONFIG =
  BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG;

export const BOARD7B_PROMPT_SKILL_V0_2_VALIDATION_RULES = [
  ...BOARD7B_PROMPT_SKILL_V0_1_VALIDATION_RULES,
  "initial_or_new_focus_uses_shift_not_new",
  "optional_semantic_objects_use_null_when_absent",
  "linked_content_question_asks_open_connection",
  "deferred_content_exits_active_focus_and_open_part"
] as const;

export const board7bPromptSkillV02TurnInputSchema =
  board7bPromptSkillV01TurnInputSchema;
export const board7bPromptSkillV02OutputSchema =
  board7bPromptSkillV01OutputSchema;
export type Board7bPromptSkillV02TurnInput = Board7bPromptSkillV01TurnInput;
export type Board7bPromptSkillV02Output = Board7bPromptSkillV01Output;
export type Board7bPromptSkillV02SemanticState =
  Board7bPromptSkillV01SemanticState;

export type Board7bPromptSkillV02Assets = {
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
    throw new Error("BOARD7B_PROMPT_SKILL_V0_2_SKILL_FRONTMATTER_INVALID");
  }
  return trimmed.slice(closingIndex + 5).trim();
}

export async function loadBoard7bPromptSkillV02Assets(
  workspaceRoot = process.cwd()
): Promise<Board7bPromptSkillV02Assets> {
  const packageDirectory = resolve(
    workspaceRoot,
    BOARD7B_PROMPT_SKILL_V0_2_PACKAGE_DIRECTORY
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
    readFile(
      resolve(packageDirectory, "board7b-semantic-result-v0.1.md"),
      "utf8"
    )
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

export function createBoard7bPromptSkillV02CandidateFingerprint(
  assets: Board7bPromptSkillV02Assets
) {
  return sha256(
    JSON.stringify({
      evaluationId: BOARD7B_PROMPT_SKILL_V0_2_EVALUATION_ID,
      decisionId: BOARD7B_PROMPT_SKILL_V0_2_DECISION_ID,
      candidateVersion: BOARD7B_PROMPT_SKILL_V0_2_CANDIDATE_VERSION,
      promptVersions: BOARD7B_PROMPT_SKILL_V0_2_PROMPT_VERSIONS,
      runtimeConfig: BOARD7B_PROMPT_SKILL_V0_2_RUNTIME_CONFIG,
      basePrompt: assets.basePrompt,
      interviewSkillSource: assets.interviewSkillSource,
      interviewSkillRuntimeBody: assets.interviewSkill,
      outputContract: assets.outputContract,
      validationRules: BOARD7B_PROMPT_SKILL_V0_2_VALIDATION_RULES
    })
  );
}

export const createBoard7bPromptSkillV02InitialSemanticState =
  createBoard7bPromptSkillV01InitialSemanticState;
export const validateBoard7bPromptSkillV02TurnInput =
  validateBoard7bPromptSkillV01TurnInput;
export const createBoard7bPromptSkillV02UserPrompt =
  createBoard7bPromptSkillV01UserPrompt;
export const parseBoard7bPromptSkillV02Output =
  parseBoard7bPromptSkillV01Output;
export const validateBoard7bPromptSkillV02Output =
  validateBoard7bPromptSkillV01Output;
export const applyBoard7bPromptSkillV02SemanticResult =
  applyBoard7bPromptSkillV01SemanticResult;
export const renderBoard7bPromptSkillV02Visible =
  renderBoard7bPromptSkillV01Visible;
