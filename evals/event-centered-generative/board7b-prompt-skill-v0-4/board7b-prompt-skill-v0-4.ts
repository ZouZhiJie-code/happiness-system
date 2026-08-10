import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  BOARD7B_PROMPT_SKILL_V0_3_RUNTIME_CONFIG,
  BOARD7B_PROMPT_SKILL_V0_3_VALIDATION_RULES,
  applyBoard7bPromptSkillV03SemanticResult,
  board7bPromptSkillV03OutputSchema,
  board7bPromptSkillV03TurnInputSchema,
  createBoard7bPromptSkillV03InitialSemanticState,
  createBoard7bPromptSkillV03UserPrompt,
  parseBoard7bPromptSkillV03Output,
  renderBoard7bPromptSkillV03Visible,
  validateBoard7bPromptSkillV03Output,
  validateBoard7bPromptSkillV03TurnInput,
  type Board7bPromptSkillV03Assets,
  type Board7bPromptSkillV03Output,
  type Board7bPromptSkillV03SemanticState,
  type Board7bPromptSkillV03TurnInput
} from "../board7b-prompt-skill-v0-3/board7b-prompt-skill-v0-3";

export const BOARD7B_PROMPT_SKILL_V0_4_EVALUATION_ID =
  "board7b_prompt_skill_v0_4" as const;
export const BOARD7B_PROMPT_SKILL_V0_4_DECISION_ID = "GI-084" as const;
export const BOARD7B_PROMPT_SKILL_V0_4_CANDIDATE_VERSION =
  "2026-08-07.board7b-prompt-skill-v0.4" as const;
export const BOARD7B_PROMPT_SKILL_V0_4_PACKAGE_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.4" as const;

const PREVIOUS_PACKAGE_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.2";

export const BOARD7B_PROMPT_SKILL_V0_4_PROMPT_VERSIONS = {
  basePrompt: "2026-08-07.board7b-base-prompt-v0.1",
  interviewSkill: "2026-08-07.board7b-interview-skill-v0.4",
  outputContract: "2026-08-07.board7b-semantic-result-v0.1",
  turnInput: "2026-08-07.board7b-turn-input-v0"
} as const;

export const BOARD7B_PROMPT_SKILL_V0_4_RUNTIME_CONFIG =
  BOARD7B_PROMPT_SKILL_V0_3_RUNTIME_CONFIG;

export const BOARD7B_PROMPT_SKILL_V0_4_VALIDATION_RULES = [
  ...BOARD7B_PROMPT_SKILL_V0_3_VALIDATION_RULES,
  "contrast_example_keeps_linked_content_as_relationship_focus"
] as const;

export const board7bPromptSkillV04TurnInputSchema =
  board7bPromptSkillV03TurnInputSchema;
export const board7bPromptSkillV04OutputSchema =
  board7bPromptSkillV03OutputSchema;
export type Board7bPromptSkillV04TurnInput = Board7bPromptSkillV03TurnInput;
export type Board7bPromptSkillV04Output = Board7bPromptSkillV03Output;
export type Board7bPromptSkillV04SemanticState =
  Board7bPromptSkillV03SemanticState;
export type Board7bPromptSkillV04Assets = Board7bPromptSkillV03Assets;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stripYamlFrontmatter(source: string) {
  const trimmed = source.trim();
  if (!trimmed.startsWith("---\n")) return trimmed;
  const closingIndex = trimmed.indexOf("\n---\n", 4);
  if (closingIndex < 0) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_4_SKILL_FRONTMATTER_INVALID");
  }
  return trimmed.slice(closingIndex + 5).trim();
}

export async function loadBoard7bPromptSkillV04Assets(
  workspaceRoot = process.cwd()
): Promise<Board7bPromptSkillV04Assets> {
  const packageDirectory = resolve(
    workspaceRoot,
    BOARD7B_PROMPT_SKILL_V0_4_PACKAGE_DIRECTORY
  );
  const previousPackageDirectory = resolve(
    workspaceRoot,
    PREVIOUS_PACKAGE_DIRECTORY
  );
  const [basePrompt, interviewSkillSource, outputContract] = await Promise.all([
    readFile(
      resolve(previousPackageDirectory, "board7b-base-prompt-v0.1.md"),
      "utf8"
    ),
    readFile(
      resolve(
        packageDirectory,
        "conduct-daily-light-thinking-interview/SKILL.md"
      ),
      "utf8"
    ),
    readFile(
      resolve(previousPackageDirectory, "board7b-semantic-result-v0.1.md"),
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

export function createBoard7bPromptSkillV04CandidateFingerprint(
  assets: Board7bPromptSkillV04Assets
) {
  return sha256(
    JSON.stringify({
      evaluationId: BOARD7B_PROMPT_SKILL_V0_4_EVALUATION_ID,
      decisionId: BOARD7B_PROMPT_SKILL_V0_4_DECISION_ID,
      candidateVersion: BOARD7B_PROMPT_SKILL_V0_4_CANDIDATE_VERSION,
      promptVersions: BOARD7B_PROMPT_SKILL_V0_4_PROMPT_VERSIONS,
      runtimeConfig: BOARD7B_PROMPT_SKILL_V0_4_RUNTIME_CONFIG,
      basePrompt: assets.basePrompt,
      interviewSkillSource: assets.interviewSkillSource,
      interviewSkillRuntimeBody: assets.interviewSkill,
      outputContract: assets.outputContract,
      validationRules: BOARD7B_PROMPT_SKILL_V0_4_VALIDATION_RULES
    })
  );
}

export const createBoard7bPromptSkillV04InitialSemanticState =
  createBoard7bPromptSkillV03InitialSemanticState;
export const validateBoard7bPromptSkillV04TurnInput =
  validateBoard7bPromptSkillV03TurnInput;
export const createBoard7bPromptSkillV04UserPrompt =
  createBoard7bPromptSkillV03UserPrompt;
export const parseBoard7bPromptSkillV04Output = parseBoard7bPromptSkillV03Output;
export const validateBoard7bPromptSkillV04Output =
  validateBoard7bPromptSkillV03Output;
export const applyBoard7bPromptSkillV04SemanticResult =
  applyBoard7bPromptSkillV03SemanticResult;
export const renderBoard7bPromptSkillV04Visible =
  renderBoard7bPromptSkillV03Visible;
