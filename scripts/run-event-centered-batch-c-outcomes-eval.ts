import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  createBatchCOutcomeCheckpoint,
  formatBatchCOutcomeReport,
  parseBatchCOutcomeCheckpoint,
  runBatchCOutcomeEvaluation
} from "../tests/evals/event-centered-batch-c/runner";
import { selectBatchCOutcomeCases } from "../tests/evals/event-centered-batch-c/catalog";
import type {
  BatchCOutcomeEvaluationCheckpoint,
  BatchCOutcomeSuite
} from "../tests/evals/event-centered-batch-c/types";

const ALL_SUITES: BatchCOutcomeSuite[] = [
  "event_journal",
  "daily_self_insight"
];

function argumentValue(name: string) {
  const inline = process.argv.find((item) => item.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || null;
  const index = process.argv.indexOf(name);
  const next = index >= 0 ? process.argv[index + 1] : null;
  return next && !next.startsWith("--") ? next : null;
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function writeAtomically(
  path: string,
  value: BatchCOutcomeEvaluationCheckpoint
) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function readCheckpoint(path: string) {
  return parseBatchCOutcomeCheckpoint(
    JSON.parse(await readFile(path, "utf8"))
  );
}

async function ensureUnusedPath(path: string) {
  try {
    await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(
    `checkpoint 已存在：${path}。继续运行请追加 --resume；新运行请更换路径。`
  );
}

const mode = argumentValue("--mode") ?? "rules";
if (mode !== "rules" && mode !== "model") {
  throw new Error("--mode 仅支持 rules 或 model。");
}

const requestedSuites =
  argumentValue("--suites")?.split(",").filter(Boolean) ?? ALL_SUITES;
const suites = requestedSuites.filter(
  (suite): suite is BatchCOutcomeSuite =>
    ALL_SUITES.includes(suite as BatchCOutcomeSuite)
);
if (!suites.length || suites.length !== requestedSuites.length) {
  throw new Error(`--suites 仅支持：${ALL_SUITES.join(", ")}`);
}

const wantsAll = process.argv.includes("--all");
if (
  mode === "model" &&
  wantsAll &&
  !process.argv.includes("--confirm-full-model-replay")
) {
  throw new Error(
    "全量真实模型回放会产生调用成本。确认后追加 --confirm-full-model-replay。"
  );
}

const sampleSize = wantsAll || mode === "rules"
  ? null
  : positiveInteger(argumentValue("--sample"), 8);
const seed = positiveInteger(argumentValue("--seed"), 20_260_723);
const judgeEnabled = process.argv.includes("--judge");
const checkpointPath = argumentValue("--checkpoint");
const resume = process.argv.includes("--resume");
if (resume && !checkpointPath) {
  throw new Error("--resume 需要同时提供 --checkpoint=<文件路径>。");
}

const selectedCaseIds = selectBatchCOutcomeCases({
  suites,
  sampleSize,
  seed
}).map((item) => item.id);
let checkpoint: BatchCOutcomeEvaluationCheckpoint | null = null;
if (checkpointPath) {
  if (resume) {
    checkpoint = await readCheckpoint(checkpointPath);
  } else {
    await ensureUnusedPath(checkpointPath);
    checkpoint = createBatchCOutcomeCheckpoint({
      mode,
      judgeEnabled,
      selectedCaseIds
    });
    await writeAtomically(checkpointPath, checkpoint);
  }
}

const report = await runBatchCOutcomeEvaluation({
  mode,
  suites,
  sampleSize,
  seed,
  judge: judgeEnabled,
  checkpoint,
  onCheckpoint: checkpointPath
    ? (nextCheckpoint) => writeAtomically(checkpointPath, nextCheckpoint)
    : undefined
});
const output = formatBatchCOutcomeReport(report);
const outputPath = argumentValue("--output");
if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${output}\n`, "utf8");
}
console.log(output);

if (
  report.providerUnavailableTotal > 0 ||
  report.failedTotal > 0 ||
  report.judgeConflictTotal > 0
) {
  process.exitCode = 1;
}
