import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  createGenerativeMvpFourAngleSmokeInput,
  createGenerativeMvpFourAngleSmokeLedger,
  createGenerativeMvpFourAngleSmokeScope,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASES,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_RUNTIME_CONFIG,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_VERSION,
  reserveGenerativeMvpFourAngleSmokeRequest,
  validateGenerativeMvpFourAngleSmokeApproval,
  type GenerativeMvpFourAngleSmokeLedger
} from "../src/features/interview/event-centered/generative-mvp-four-angle-smoke";
import type { AIProvider } from "../src/server/services/ai/ai-provider";
import {
  getEventCenteredAIProvider,
  readEventCenteredGenerativeModel
} from "../src/server/services/ai/event-centered-provider";
import {
  generateEventCenteredGenerativeSemanticPlanAI,
  generateEventCenteredGenerativeVisibleTurnAI,
  type EventCenteredGenerativeSemanticPlanArtifact
} from "../src/server/services/interview/event-centered-ai.service";

const artifactDirectory = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-02"
);
const approvalPath = resolve(
  artifactDirectory,
  "board7-mvp-four-angle-smoke-v1-approval.json"
);
const checkpointPath = resolve(
  artifactDirectory,
  "board7-mvp-four-angle-smoke-v1.checkpoint.json"
);
const resultPath = resolve(
  artifactDirectory,
  "board7-mvp-four-angle-smoke-v1.json"
);
const reportPath = resolve(
  artifactDirectory,
  "board7-mvp-four-angle-smoke-v1-report.md"
);

type SmokeCaseResult = {
  caseId: string;
  angle: string;
  expected: {
    state: string;
    action: string;
    origin: string | null;
  };
  semantic: {
    artifact: EventCenteredGenerativeSemanticPlanArtifact | null;
    validationIssues: string[];
    qualityDiagnostics: string[];
  };
  visible: {
    response: string | null;
    thinkingSummary: string | null;
    validationIssues: string[];
    qualityDiagnostics: string[];
  };
  terminalStatus: "complete" | "semantic_failed" | "visible_failed";
};

type SmokeCheckpoint = {
  evaluation: "board7_mvp_four_angle_smoke";
  datasetVersion: typeof GENERATIVE_MVP_FOUR_ANGLE_SMOKE_VERSION;
  caseFingerprint: string;
  scopeFingerprint: string;
  model: string;
  status: "running" | "completed" | "aborted";
  startedAt: string;
  completedAt: string | null;
  ledger: GenerativeMvpFourAngleSmokeLedger;
  inProgress: {
    caseId: string;
    semanticArtifact: EventCenteredGenerativeSemanticPlanArtifact | null;
  } | null;
  results: SmokeCaseResult[];
  error: string | null;
};

async function writeAtomic(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, value, "utf8");
  await rename(temporaryPath, path);
}

async function writeJson(path: string, value: unknown) {
  await writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readCheckpoint(): Promise<SmokeCheckpoint | null> {
  try {
    return await readJson<SmokeCheckpoint>(checkpointPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function assertCheckpoint(checkpoint: SmokeCheckpoint) {
  if (
    checkpoint.evaluation !== "board7_mvp_four_angle_smoke" ||
    checkpoint.datasetVersion !== GENERATIVE_MVP_FOUR_ANGLE_SMOKE_VERSION ||
    checkpoint.caseFingerprint !== GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT ||
    checkpoint.scopeFingerprint !== GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT ||
    checkpoint.model !== GENERATIVE_MVP_FOUR_ANGLE_SMOKE_RUNTIME_CONFIG.model ||
    checkpoint.ledger.scopeFingerprint !== GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT
  ) {
    throw new Error("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CHECKPOINT_MISMATCH");
  }
}

function visibleResponse(turn: Awaited<ReturnType<
  typeof generateEventCenteredGenerativeVisibleTurnAI
>>["turn"]) {
  return turn?.visibleTurn.question ??
    turn?.visibleTurn.insight ??
    turn?.visibleTurn.honestLimit ??
    null;
}

function formatReport(checkpoint: SmokeCheckpoint) {
  const complete = checkpoint.results.filter((item) =>
    item.terminalStatus === "complete"
  ).length;
  const lines = [
    "# 板块 7｜四角度 MVP 最小真实模型验证",
    "",
    `- 数据集：${checkpoint.datasetVersion}`,
    `- 案例指纹：${checkpoint.caseFingerprint}`,
    `- 模型：${checkpoint.model}`,
    `- 技术完整：${complete}/4`,
    `- 生成请求：${checkpoint.ledger.requests.length}/16`,
    `- 运行状态：${checkpoint.status}`,
    `- 产品结论：${complete === 4 ? "待 Codex 逐条评审" : "技术阻断"}`,
    ""
  ];
  for (const item of checkpoint.results) {
    lines.push(
      `## ${item.caseId}｜${item.angle}`,
      "",
      `- 终态：${item.terminalStatus}`,
      `- 预期：${item.expected.state} / ${item.expected.action} / ${item.expected.origin ?? "null"}`,
      `- 实际回应：${item.visible.response ?? "无"}`,
      `- 思路：${item.visible.thinkingSummary ?? "无"}`,
      `- 语义问题：${item.semantic.validationIssues.join("；") || "无"}`,
      `- 表达问题：${item.visible.validationIssues.join("；") || "无"}`,
      ""
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

async function main() {
  loadEnvConfig(process.cwd());
  if (process.argv.includes("--describe")) {
    process.stdout.write(`${JSON.stringify(createGenerativeMvpFourAngleSmokeScope(), null, 2)}\n`);
    return;
  }

  validateGenerativeMvpFourAngleSmokeApproval(await readJson<unknown>(approvalPath));
  const configuredModel = readEventCenteredGenerativeModel();
  if (configuredModel !== GENERATIVE_MVP_FOUR_ANGLE_SMOKE_RUNTIME_CONFIG.model) {
    throw new Error("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_MODEL_MISMATCH");
  }
  const provider = await getEventCenteredAIProvider();
  if (!provider) throw new Error("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_PROVIDER_UNAVAILABLE");

  let checkpoint = await readCheckpoint() ?? {
    evaluation: "board7_mvp_four_angle_smoke" as const,
    datasetVersion: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_VERSION,
    caseFingerprint: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT,
    scopeFingerprint: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT,
    model: configuredModel,
    status: "running" as const,
    startedAt: new Date().toISOString(),
    completedAt: null,
    ledger: createGenerativeMvpFourAngleSmokeLedger(),
    inProgress: null,
    results: [],
    error: null
  };
  assertCheckpoint(checkpoint);
  if (checkpoint.status !== "running") {
    throw new Error("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_ALREADY_TERMINAL");
  }

  const persist = async () => writeJson(checkpointPath, checkpoint);
  const trackedProvider = (caseId: string, stage: "semantic" | "visible"): AIProvider => ({
    name: `${provider.name}:board7-mvp-four-angle`,
    async complete(params) {
      const attemptIndex = checkpoint.ledger.requests.filter((item) =>
        item.caseId === caseId && item.stage === stage
      ).length + 1;
      checkpoint.ledger = reserveGenerativeMvpFourAngleSmokeRequest(
        checkpoint.ledger,
        { caseId, stage, attemptIndex: attemptIndex as 1 | 2 }
      );
      await persist();
      return provider.complete(params);
    }
  });

  try {
    for (const caseItem of GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASES) {
      if (checkpoint.results.some((item) => item.caseId === caseItem.id)) continue;
      const input = createGenerativeMvpFourAngleSmokeInput(caseItem);
      let semanticArtifact = checkpoint.inProgress?.caseId === caseItem.id
        ? checkpoint.inProgress.semanticArtifact
        : null;
      let semanticIssues: string[] = [];
      let semanticDiagnostics: string[] = [];
      if (!semanticArtifact) {
        const semantic = await generateEventCenteredGenerativeSemanticPlanAI({
          ...input,
          provider: trackedProvider(caseItem.id, "semantic"),
          maxAttempts: 2
        });
        semanticArtifact = semantic.artifact;
        semanticIssues = semantic.validationIssues;
        semanticDiagnostics = semantic.qualityDiagnostics;
        checkpoint.inProgress = {
          caseId: caseItem.id,
          semanticArtifact
        };
        await persist();
      }

      let visible: Awaited<ReturnType<
        typeof generateEventCenteredGenerativeVisibleTurnAI
      >> | null = null;
      if (semanticArtifact) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          visible = await generateEventCenteredGenerativeVisibleTurnAI({
            ...input,
            provider: trackedProvider(caseItem.id, "visible"),
            artifact: semanticArtifact
          });
          if (visible.turn) break;
        }
      }
      const terminalStatus = !semanticArtifact
        ? "semantic_failed" as const
        : visible?.turn
          ? "complete" as const
          : "visible_failed" as const;
      checkpoint.results.push({
        caseId: caseItem.id,
        angle: caseItem.angle,
        expected: {
          state: caseItem.expectedDecision.state,
          action: caseItem.expectedDecision.action,
          origin: caseItem.expectedDecision.origin
        },
        semantic: {
          artifact: semanticArtifact,
          validationIssues: semanticIssues,
          qualityDiagnostics: semanticDiagnostics
        },
        visible: {
          response: visibleResponse(visible?.turn ?? null),
          thinkingSummary: visible?.turn?.visibleTurn.thinkingSummary ?? null,
          validationIssues: visible?.validationIssues ?? [
            "VISIBLE_SKIPPED_AFTER_SEMANTIC_FAILURE"
          ],
          qualityDiagnostics: visible?.qualityDiagnostics ?? []
        },
        terminalStatus
      });
      checkpoint.inProgress = null;
      await persist();
    }

    checkpoint = {
      ...checkpoint,
      status: "completed",
      completedAt: new Date().toISOString(),
      ledger: { ...checkpoint.ledger, status: "completed" }
    };
    await writeJson(checkpointPath, checkpoint);
    await writeJson(resultPath, {
      ...checkpoint,
      gate: checkpoint.results.every((item) => item.terminalStatus === "complete")
        ? "pending_codex_review"
        : "technical_failed"
    });
    await writeAtomic(reportPath, formatReport(checkpoint));
  } catch (error) {
    checkpoint = {
      ...checkpoint,
      status: "aborted",
      completedAt: new Date().toISOString(),
      ledger: { ...checkpoint.ledger, status: "aborted" },
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR"
    };
    await writeJson(checkpointPath, checkpoint);
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "UNKNOWN_ERROR"}\n`);
  process.exitCode = 1;
});
