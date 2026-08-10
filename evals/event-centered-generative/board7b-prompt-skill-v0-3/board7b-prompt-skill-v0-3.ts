import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  BOARD7B_PROMPT_SKILL_V0_2_RUNTIME_CONFIG,
  BOARD7B_PROMPT_SKILL_V0_2_VALIDATION_RULES,
  applyBoard7bPromptSkillV02SemanticResult,
  board7bPromptSkillV02OutputSchema,
  board7bPromptSkillV02TurnInputSchema,
  createBoard7bPromptSkillV02InitialSemanticState,
  createBoard7bPromptSkillV02UserPrompt,
  parseBoard7bPromptSkillV02Output,
  renderBoard7bPromptSkillV02Visible,
  validateBoard7bPromptSkillV02Output,
  validateBoard7bPromptSkillV02TurnInput,
  type Board7bPromptSkillV02Assets,
  type Board7bPromptSkillV02Output,
  type Board7bPromptSkillV02SemanticState,
  type Board7bPromptSkillV02TurnInput
} from "../board7b-prompt-skill-v0-2/board7b-prompt-skill-v0-2";

export const BOARD7B_PROMPT_SKILL_V0_3_EVALUATION_ID =
  "board7b_prompt_skill_v0_3" as const;
export const BOARD7B_PROMPT_SKILL_V0_3_DECISION_ID = "GI-084" as const;
export const BOARD7B_PROMPT_SKILL_V0_3_CANDIDATE_VERSION =
  "2026-08-07.board7b-prompt-skill-v0.3" as const;
export const BOARD7B_PROMPT_SKILL_V0_3_PACKAGE_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.3" as const;

const PREVIOUS_PACKAGE_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.2";

export const BOARD7B_PROMPT_SKILL_V0_3_PROMPT_VERSIONS = {
  basePrompt: "2026-08-07.board7b-base-prompt-v0.1",
  interviewSkill: "2026-08-07.board7b-interview-skill-v0.3",
  outputContract: "2026-08-07.board7b-semantic-result-v0.1",
  turnInput: "2026-08-07.board7b-turn-input-v0"
} as const;

export const BOARD7B_PROMPT_SKILL_V0_3_RUNTIME_CONFIG =
  BOARD7B_PROMPT_SKILL_V0_2_RUNTIME_CONFIG;

export const BOARD7B_PROMPT_SKILL_V0_3_VALIDATION_RULES = [
  ...BOARD7B_PROMPT_SKILL_V0_2_VALIDATION_RULES,
  "visible_understanding_is_declarative",
  "visible_response_contains_one_question_task"
] as const;

export const board7bPromptSkillV03TurnInputSchema =
  board7bPromptSkillV02TurnInputSchema;
export const board7bPromptSkillV03OutputSchema =
  board7bPromptSkillV02OutputSchema;
export type Board7bPromptSkillV03TurnInput = Board7bPromptSkillV02TurnInput;
export type Board7bPromptSkillV03Output = Board7bPromptSkillV02Output;
export type Board7bPromptSkillV03SemanticState =
  Board7bPromptSkillV02SemanticState;
export type Board7bPromptSkillV03Assets = Board7bPromptSkillV02Assets;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stripYamlFrontmatter(source: string) {
  const trimmed = source.trim();
  if (!trimmed.startsWith("---\n")) return trimmed;
  const closingIndex = trimmed.indexOf("\n---\n", 4);
  if (closingIndex < 0) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_3_SKILL_FRONTMATTER_INVALID");
  }
  return trimmed.slice(closingIndex + 5).trim();
}

export async function loadBoard7bPromptSkillV03Assets(
  workspaceRoot = process.cwd()
): Promise<Board7bPromptSkillV03Assets> {
  const packageDirectory = resolve(
    workspaceRoot,
    BOARD7B_PROMPT_SKILL_V0_3_PACKAGE_DIRECTORY
  );
  const previousPackageDirectory = resolve(
    workspaceRoot,
    PREVIOUS_PACKAGE_DIRECTORY
  );
  const [basePrompt, interviewSkillSource, outputContract] = await Promise.all([
    readFile(resolve(previousPackageDirectory, "board7b-base-prompt-v0.1.md"), "utf8"),
    readFile(
      resolve(packageDirectory, "conduct-daily-light-thinking-interview/SKILL.md"),
      "utf8"
    ),
    readFile(resolve(previousPackageDirectory, "board7b-semantic-result-v0.1.md"), "utf8")
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

export function createBoard7bPromptSkillV03CandidateFingerprint(
  assets: Board7bPromptSkillV03Assets
) {
  return sha256(
    JSON.stringify({
      evaluationId: BOARD7B_PROMPT_SKILL_V0_3_EVALUATION_ID,
      decisionId: BOARD7B_PROMPT_SKILL_V0_3_DECISION_ID,
      candidateVersion: BOARD7B_PROMPT_SKILL_V0_3_CANDIDATE_VERSION,
      promptVersions: BOARD7B_PROMPT_SKILL_V0_3_PROMPT_VERSIONS,
      runtimeConfig: BOARD7B_PROMPT_SKILL_V0_3_RUNTIME_CONFIG,
      basePrompt: assets.basePrompt,
      interviewSkillSource: assets.interviewSkillSource,
      interviewSkillRuntimeBody: assets.interviewSkill,
      outputContract: assets.outputContract,
      validationRules: BOARD7B_PROMPT_SKILL_V0_3_VALIDATION_RULES
    })
  );
}

export const createBoard7bPromptSkillV03InitialSemanticState =
  createBoard7bPromptSkillV02InitialSemanticState;
export const validateBoard7bPromptSkillV03TurnInput =
  validateBoard7bPromptSkillV02TurnInput;
export const createBoard7bPromptSkillV03UserPrompt =
  createBoard7bPromptSkillV02UserPrompt;
export const parseBoard7bPromptSkillV03Output = parseBoard7bPromptSkillV02Output;
export const validateBoard7bPromptSkillV03Output =
  validateBoard7bPromptSkillV02Output;
export const applyBoard7bPromptSkillV03SemanticResult =
  applyBoard7bPromptSkillV02SemanticResult;
export const renderBoard7bPromptSkillV03Visible =
  renderBoard7bPromptSkillV02Visible;
