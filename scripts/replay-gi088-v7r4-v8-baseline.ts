import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Board7bWorkingTaskV1TurnInput } from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_DETERMINISTIC_STATE_POLICY_VERSION,
  assessGi088ExplicitStop,
  createGi088DeterministicPauseOutput,
  normalizeGi088DeterministicStateOutput
} from "../src/server/services/evaluation/gi088/deterministic-state";
import {
  applyGi088SemanticDeltaValidatedResult,
  assertGi088SemanticDeltaOutput,
  parseGi088SemanticDeltaCandidateOutput,
  toBoard7bWorkingTaskV1CompatibilityOutput,
  validateGi088SemanticDeltaOutput
} from "../src/server/services/evaluation/gi088/semantic-delta";
import { validateGi088StageTransitionOutput } from "../src/server/services/evaluation/gi088/stage-transition";
import type {
  Gi088BatchState,
  Gi088Trajectory,
  Gi088Turn
} from "../src/server/services/evaluation/gi088/types";

const EXPECTED_EXPORT_SHA256 =
  "c5bcaaa92a870f6b1082a4978b4bc6d41048b0a6dae1a06656f2439ebb930334";
const EXPECTED_EVALUATION_VERSION =
  "2026-08-10.gi088-human-eval-v7r4-pro";
const DEFAULT_EXPORT_PATH = resolve(
  process.cwd(),
  "artifacts/local-runtime/gi088-v7r4-sealed/v7r4-sealed-export.json"
);

type ExportShape = {
  evaluation: { version: string };
  batch: Gi088BatchState;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function highTrajectory(batch: Gi088BatchState, taskId: string) {
  const trajectory = batch.tasks.find((task) => task.taskId === taskId)
    ?.branches.high;
  if (!trajectory) throw new Error(`GI088_V8_REPLAY_TASK_MISSING:${taskId}`);
  return trajectory;
}

function turn(trajectory: Gi088Trajectory, userMessageId: string) {
  const value = trajectory.turns.find(
    (candidate) => candidate.userMessageId === userMessageId
  );
  if (!value) throw new Error(`GI088_V8_REPLAY_TURN_MISSING:${userMessageId}`);
  return value;
}

function inputFor(trajectory: Gi088Trajectory, value: Gi088Turn) {
  return {
    mode: "accompany_chat" as const,
    conversation: trajectory.messages,
    latestUserMessageId: value.userMessageId,
    semanticState: value.semanticStateBefore
  } satisfies Board7bWorkingTaskV1TurnInput;
}

async function main() {
  const sourcePath = resolve(process.argv[2] ?? DEFAULT_EXPORT_PATH);
  const source = await readFile(sourcePath, "utf8");
  if (sha256(source) !== EXPECTED_EXPORT_SHA256) {
    throw new Error("GI088_V8_REPLAY_EXPORT_SHA256_MISMATCH");
  }
  const exported = JSON.parse(source) as ExportShape;
  if (
    exported.evaluation?.version !== EXPECTED_EVALUATION_VERSION ||
    exported.batch?.status !== "sealed"
  ) {
    throw new Error("GI088_V8_REPLAY_EXPORT_LINEAGE_MISMATCH");
  }

  const a1 = highTrajectory(exported.batch, "A1");
  const a1u4 = turn(a1, "U4");
  const a1Raw = a1u4.calls.at(-1)?.rawFinalOutput;
  if (!a1Raw) throw new Error("GI088_V8_REPLAY_A1_U4_RAW_OUTPUT_MISSING");
  const a1Input = inputFor(a1, a1u4);
  const a1Candidate = parseGi088SemanticDeltaCandidateOutput(a1Raw);
  const a1Normalized = normalizeGi088DeterministicStateOutput({
    turnInput: a1Input,
    output: a1Candidate
  });
  const a1Effective = assertGi088SemanticDeltaOutput(a1Normalized.output);
  const a1Issues = [
    ...validateGi088SemanticDeltaOutput({
      input: a1Input,
      output: a1Effective,
      deterministicStateMaintenance: true
    }),
    ...validateGi088StageTransitionOutput({
      input: a1Input,
      output: toBoard7bWorkingTaskV1CompatibilityOutput(
        a1Input,
        a1Effective
      )
    })
  ].filter((issue) => !/^ASK_QUESTION_COUNT_INVALID:\d+$/u.test(issue));
  if (a1Issues.length) {
    throw new Error(`GI088_V8_REPLAY_A1_U4_FAILED:${a1Issues.join(",")}`);
  }
  if (
    a1Effective.semantic.nextInquiry?.evidenceRefs.length !== 1 ||
    a1Normalized.maintenance.sourceCompletion.reviewCandidate !==
      "program_source_completion"
  ) {
    throw new Error("GI088_V8_REPLAY_A1_U4_SOURCE_NOT_COMPLETED");
  }

  const a2 = highTrajectory(exported.batch, "A2");
  const a2u8 = turn(a2, "U8");
  const a2Message = a2.messages.find(
    (message) => message.id === a2u8.userMessageId && message.role === "user"
  );
  if (!a2Message) throw new Error("GI088_V8_REPLAY_A2_U8_MESSAGE_MISSING");
  const a2Stop = assessGi088ExplicitStop({ content: a2Message.content });
  if (a2Stop !== "pure") {
    throw new Error(`GI088_V8_REPLAY_A2_U8_STOP_MISMATCH:${a2Stop}`);
  }
  const a2Input = inputFor(a2, a2u8);
  const a2Pause = createGi088DeterministicPauseOutput({
    turnInput: a2Input,
    explicitStop: "pure"
  });
  const a2State = applyGi088SemanticDeltaValidatedResult({
    input: a2Input,
    output: a2Pause.output
  });
  if (a2Pause.output.semantic.action !== "pause" || a2State.nextInquiry) {
    throw new Error("GI088_V8_REPLAY_A2_U8_STOP_NOT_COMMITTED");
  }

  console.log(
    JSON.stringify(
      {
        replayVersion: "2026-08-10.gi088-v7r4-v8-baseline-replay-v1",
        sourceEvaluationVersion: EXPECTED_EVALUATION_VERSION,
        sourceExportSha256: EXPECTED_EXPORT_SHA256,
        deterministicStatePolicyVersion:
          GI088_DETERMINISTIC_STATE_POLICY_VERSION,
        results: {
          A1_U4: {
            sourceCompletion:
              a1Normalized.maintenance.sourceCompletion.reviewCandidate,
            appliedFields:
              a1Normalized.maintenance.sourceCompletion.appliedFields,
            validationIssues: [],
            replayProviderCalls: 0
          },
          A2_U8: {
            explicitStop: a2Stop,
            effectiveAction: a2Pause.output.semantic.action,
            nextInquiryCleared: a2State.nextInquiry === null,
            replayProviderCalls: 0
          }
        },
        rawUserContentPrinted: false,
        rawModelOutputPrinted: false,
        modelGenerationCalls: 0
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "GI088_V8_REPLAY_FAILED"
  );
  process.exitCode = 1;
});
