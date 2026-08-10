import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Board7bWorkingTaskV1TurnInput } from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_DETERMINISTIC_STATE_POLICY_VERSION,
  assessGi088ExplicitStop,
  normalizeGi088DeterministicStateOutput
} from "../src/server/services/evaluation/gi088/deterministic-state";
import {
  applyGi088SemanticDeltaValidatedResult,
  parseGi088SemanticDeltaOutput,
  validateGi088SemanticDeltaOutput
} from "../src/server/services/evaluation/gi088/semantic-delta";
import type {
  Gi088BatchState,
  Gi088Trajectory,
  Gi088Turn
} from "../src/server/services/evaluation/gi088/types";

const EXPECTED_EXPORT_SHA256 =
  "cf42c7f747143fa8f217f8790fe01d8cc77b8adef97ea6e6ea7b8858888373f1";
const EXPECTED_EVALUATION_VERSION =
  "2026-08-10.gi088-human-eval-v7r2-ark-flash";
const DEFAULT_EXPORT_PATH =
  "/Users/zouzhijie/Downloads/2026-08-10.gi088-human-eval-v7r2-ark-flash-c10c8c25-b3f9-4bfb-a02a-c5c0a44c303c-2-of-2.json";

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
  if (!trajectory) throw new Error(`GI088_REPLAY_TASK_MISSING:${taskId}`);
  return trajectory;
}

function turn(trajectory: Gi088Trajectory, userMessageId: string) {
  const value = trajectory.turns.find(
    (candidate) => candidate.userMessageId === userMessageId
  );
  if (!value) {
    throw new Error(`GI088_REPLAY_TURN_MISSING:${userMessageId}`);
  }
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
    throw new Error("GI088_REPLAY_EXPORT_SHA256_MISMATCH");
  }
  const exported = JSON.parse(source) as ExportShape;
  if (
    exported.evaluation?.version !== EXPECTED_EVALUATION_VERSION ||
    exported.batch?.status !== "sealed"
  ) {
    throw new Error("GI088_REPLAY_EXPORT_LINEAGE_MISMATCH");
  }

  const a1 = highTrajectory(exported.batch, "A1");
  const a1u8 = turn(a1, "U8");
  const a1UserMessage = a1.messages.find(
    (message) => message.id === a1u8.userMessageId && message.role === "user"
  );
  if (!a1UserMessage) throw new Error("GI088_REPLAY_A1_U8_MESSAGE_MISSING");
  const a1Input = inputFor(a1, a1u8);
  const a1Stop = assessGi088ExplicitStop({
    content: a1UserMessage.content,
    lastAssistantMessage: [...a1.messages]
      .slice(0, a1.messages.indexOf(a1UserMessage))
      .reverse()
      .find((message) => message.role === "assistant")?.content
  });
  if (a1Stop !== "mixed") {
    throw new Error(`GI088_REPLAY_A1_U8_STOP_MISMATCH:${a1Stop}`);
  }
  const a1Raw = a1u8.calls.at(-1)?.rawFinalOutput;
  if (!a1Raw) throw new Error("GI088_REPLAY_A1_U8_RAW_OUTPUT_MISSING");
  const a1RawOutput = parseGi088SemanticDeltaOutput(a1Raw);
  const a1Result = normalizeGi088DeterministicStateOutput({
    turnInput: a1Input,
    output: a1RawOutput,
    explicitStop: "mixed"
  });
  const a1State = applyGi088SemanticDeltaValidatedResult({
    input: a1Input,
    output: a1Result.output
  });
  if (a1Result.output.semantic.action !== "pause" || a1State.nextInquiry) {
    throw new Error("GI088_REPLAY_A1_U8_STOP_NOT_COMMITTED");
  }

  const a2 = highTrajectory(exported.batch, "A2");
  const a2u7 = turn(a2, "U7");
  const a2Raw = a2u7.calls.at(-1)?.rawFinalOutput;
  if (!a2Raw) throw new Error("GI088_REPLAY_A2_U7_RAW_OUTPUT_MISSING");
  const a2Input = inputFor(a2, a2u7);
  const a2Output = parseGi088SemanticDeltaOutput(a2Raw);
  const a2Issues = validateGi088SemanticDeltaOutput({
    input: a2Input,
    output: a2Output,
    deterministicStateMaintenance: true
  }).filter((issue) => !/^ASK_QUESTION_COUNT_INVALID:\d+$/u.test(issue));
  if (a2Issues.length) {
    throw new Error(`GI088_REPLAY_A2_U7_VALIDATION_FAILED:${a2Issues.join(",")}`);
  }
  const a2Normalized = normalizeGi088DeterministicStateOutput({
    turnInput: a2Input,
    output: a2Output
  });
  const a2State = applyGi088SemanticDeltaValidatedResult({
    input: a2Input,
    output: a2Normalized.output
  });
  if (
    a2State.stage !== "deepen_integrate" ||
    a2Normalized.maintenance.workingTaskLineage !== "merged"
  ) {
    throw new Error("GI088_REPLAY_A2_U7_STATE_NOT_COMMITTED");
  }

  console.log(
    JSON.stringify(
      {
        replayVersion: "2026-08-10.gi088-v7r2-private-replay-v1",
        sourceEvaluationVersion: EXPECTED_EVALUATION_VERSION,
        sourceExportSha256: EXPECTED_EXPORT_SHA256,
        deterministicStatePolicyVersion:
          GI088_DETERMINISTIC_STATE_POLICY_VERSION,
        results: {
          A1_U8: {
            explicitStop: a1Stop,
            effectiveAction: a1Result.output.semantic.action,
            nextInquiryCleared: a1State.nextInquiry === null,
            replayProviderCalls: 0,
            liveMaximumProviderCalls: 1
          },
          A2_U7: {
            effectiveStage: a2State.stage,
            rawSubmittedEvidenceCount:
              a2Output.semantic.workingTask?.evidenceRefs.length ?? 0,
            effectiveEvidenceCount:
              a2Normalized.output.semantic.workingTask?.evidenceRefs.length ?? 0,
            lineageMaintenance:
              a2Normalized.maintenance.workingTaskLineage,
            validationIssues: []
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
  console.error(error instanceof Error ? error.message : "GI088_REPLAY_FAILED");
  process.exitCode = 1;
});
