import {
  BOARD7B_PROMPT_SKILL_V0_4_CANDIDATE_VERSION,
  BOARD7B_PROMPT_SKILL_V0_4_RUNTIME_CONFIG,
  createBoard7bPromptSkillV04CandidateFingerprint,
  loadBoard7bPromptSkillV04Assets
} from "../evals/event-centered-generative/board7b-prompt-skill-v0-4/board7b-prompt-skill-v0-4";

async function main() {
  const assets = await loadBoard7bPromptSkillV04Assets();
  process.stdout.write(
    `${JSON.stringify(
      {
        candidateVersion: BOARD7B_PROMPT_SKILL_V0_4_CANDIDATE_VERSION,
        candidateFingerprint:
          createBoard7bPromptSkillV04CandidateFingerprint(assets),
        runtimeConfig: BOARD7B_PROMPT_SKILL_V0_4_RUNTIME_CONFIG,
        modelCalls: 0
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
