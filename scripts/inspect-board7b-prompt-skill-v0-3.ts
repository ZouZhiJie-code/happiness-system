import {
  BOARD7B_PROMPT_SKILL_V0_3_CANDIDATE_VERSION,
  BOARD7B_PROMPT_SKILL_V0_3_RUNTIME_CONFIG,
  createBoard7bPromptSkillV03CandidateFingerprint,
  loadBoard7bPromptSkillV03Assets
} from "../evals/event-centered-generative/board7b-prompt-skill-v0-3/board7b-prompt-skill-v0-3";

async function main() {
  const assets = await loadBoard7bPromptSkillV03Assets();
  process.stdout.write(
    `${JSON.stringify(
      {
        candidateVersion: BOARD7B_PROMPT_SKILL_V0_3_CANDIDATE_VERSION,
        candidateFingerprint:
          createBoard7bPromptSkillV03CandidateFingerprint(assets),
        runtimeConfig: BOARD7B_PROMPT_SKILL_V0_3_RUNTIME_CONFIG,
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
