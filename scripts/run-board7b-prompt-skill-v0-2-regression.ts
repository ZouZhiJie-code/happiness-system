import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import {
  BOARD7B_PROMPT_SKILL_V0_2_CANDIDATE_VERSION,
  BOARD7B_PROMPT_SKILL_V0_2_RUNTIME_CONFIG,
  createBoard7bPromptSkillV02CandidateFingerprint,
  loadBoard7bPromptSkillV02Assets
} from "../evals/event-centered-generative/board7b-prompt-skill-v0-2/board7b-prompt-skill-v0-2";
import {
  createProvider,
  createRegressionCases,
  executeCase,
  resolveCandidateCredential,
  sha256,
  validateCredential,
  writeJsonAtomic,
  type RegressionCallRecord
} from "./run-board7b-prompt-skill-v0-1-regression";

const PACKAGE_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.2";
const LOCAL_RUNTIME_DIRECTORY =
  "artifacts/local-runtime/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.2";
const AUTHORIZATION_FILE =
  "board7b-prompt-skill-v0.2-regression-authorization.json";
const REGRESSION_PLAN_FILE = "board7b-prompt-skill-v0.2-regression-plan.json";

const authorizationSchema = z
  .object({
    authorizationVersion: z.literal(
      "2026-08-07.board7b-prompt-skill-authorization-v0.2"
    ),
    decision: z.literal("approved"),
    candidateVersion: z.literal(
      BOARD7B_PROMPT_SKILL_V0_2_CANDIDATE_VERSION
    ),
    candidateFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    authorizationScope: z.literal("eight_case_hidden_regression"),
    authorizedModelCallBudget: z.literal(8),
    authorizedEnvironment: z.literal("isolated_local_evaluation"),
    approvedBy: z.literal("product_owner_conversation"),
    approvedAt: z.string().datetime(),
    productionChangeAuthorized: z.literal(false)
  })
  .passthrough();

const regressionPlanSchema = z
  .object({
    planVersion: z.string().trim().min(1),
    candidateVersion: z.literal(
      BOARD7B_PROMPT_SKILL_V0_2_CANDIDATE_VERSION
    ),
    candidateFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    plannedCalls: z.literal(8),
    authorizedCalls: z.literal(0)
  })
  .passthrough();

async function main() {
  const workspaceRoot = process.cwd();
  const packagePath = resolve(workspaceRoot, PACKAGE_DIRECTORY);
  const [assets, authorizationSource, planSource] = await Promise.all([
    loadBoard7bPromptSkillV02Assets(workspaceRoot),
    readFile(resolve(packagePath, AUTHORIZATION_FILE), "utf8"),
    readFile(resolve(packagePath, REGRESSION_PLAN_FILE), "utf8")
  ]);
  const candidateFingerprint =
    createBoard7bPromptSkillV02CandidateFingerprint(assets);
  const authorization = authorizationSchema.parse(
    JSON.parse(authorizationSource) as unknown
  );
  const plan = regressionPlanSchema.parse(JSON.parse(planSource) as unknown);
  if (
    authorization.candidateFingerprint !== candidateFingerprint ||
    plan.candidateFingerprint !== candidateFingerprint
  ) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_2_FINGERPRINT_MISMATCH");
  }
  const cases = createRegressionCases();
  if (
    cases.length !== authorization.authorizedModelCallBudget ||
    cases.length !== plan.plannedCalls
  ) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_2_CALL_BUDGET_MISMATCH");
  }
  const runFingerprint = sha256(
    JSON.stringify({
      candidateFingerprint,
      authorizationVersion: authorization.authorizationVersion,
      approvedAt: authorization.approvedAt,
      planVersion: plan.planVersion,
      callBudget: cases.length
    })
  );
  const outputPath = resolve(
    workspaceRoot,
    LOCAL_RUNTIME_DIRECTORY,
    `regression-${runFingerprint}`,
    "raw-results.json"
  );
  const run = {
    evaluationId: "board7b_prompt_skill_v0_2_regression",
    candidateVersion: BOARD7B_PROMPT_SKILL_V0_2_CANDIDATE_VERSION,
    candidateFingerprint,
    runFingerprint,
    planVersion: plan.planVersion,
    authorization: {
      version: authorization.authorizationVersion,
      scope: authorization.authorizationScope,
      approvedBy: authorization.approvedBy,
      approvedAt: authorization.approvedAt,
      callBudget: authorization.authorizedModelCallBudget
    },
    runtimeConfig: BOARD7B_PROMPT_SKILL_V0_2_RUNTIME_CONFIG,
    startedAt: new Date().toISOString(),
    completedAt: null as string | null,
    calls: [] as RegressionCallRecord[]
  };

  if (!process.argv.includes("--run")) {
    process.stdout.write(
      `${JSON.stringify(
        {
          candidateFingerprint,
          runFingerprint,
          authorization: "valid",
          plannedCalls: cases.length,
          modelCalls: 0
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const credential = await resolveCandidateCredential();
  await validateCredential(credential.apiKey);
  const provider = await createProvider(credential.apiKey);
  await writeJsonAtomic(outputPath, run);
  process.stdout.write(
    `GI-084 v0.2 回归开始：指纹 ${candidateFingerprint.slice(0, 12)}…，预算 8，凭据 ${credential.source}。\n`
  );
  for (const regressionCase of cases) {
    const record = await executeCase({
      regressionCase,
      provider,
      systemPrompt: assets.systemPrompt
    });
    run.calls.push(record);
    await writeJsonAtomic(outputPath, run);
    process.stdout.write(
      `调用 ${record.callNumber}/8｜${record.caseId}#${record.repetition}｜${record.status}\n`
    );
  }
  run.completedAt = new Date().toISOString();
  await writeJsonAtomic(outputPath, run);
  process.stdout.write(
    `${JSON.stringify(
      {
        runFingerprint,
        outputPath,
        attemptedCalls: run.calls.length,
        valid: run.calls.filter((call) => call.status === "valid").length,
        protectedFailures: run.calls.filter(
          (call) => call.status === "protected_failure"
        ).length,
        technicalFailures: run.calls.filter(
          (call) => call.status === "technical_failure"
        ).length
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
