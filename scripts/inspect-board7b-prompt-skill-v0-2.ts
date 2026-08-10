import {
  BOARD7B_PROMPT_SKILL_V0_2_CANDIDATE_VERSION,
  BOARD7B_PROMPT_SKILL_V0_2_PROMPT_VERSIONS,
  BOARD7B_PROMPT_SKILL_V0_2_RUNTIME_CONFIG,
  createBoard7bPromptSkillV02CandidateFingerprint,
  loadBoard7bPromptSkillV02Assets
} from "../evals/event-centered-generative/board7b-prompt-skill-v0-2/board7b-prompt-skill-v0-2";

const assets = await loadBoard7bPromptSkillV02Assets();

process.stdout.write(
  `${JSON.stringify(
    {
      candidateVersion: BOARD7B_PROMPT_SKILL_V0_2_CANDIDATE_VERSION,
      candidateFingerprint:
        createBoard7bPromptSkillV02CandidateFingerprint(assets),
      promptVersions: BOARD7B_PROMPT_SKILL_V0_2_PROMPT_VERSIONS,
      runtimeConfig: BOARD7B_PROMPT_SKILL_V0_2_RUNTIME_CONFIG,
      modelCalls: 0
    },
    null,
    2
  )}\n`
);
