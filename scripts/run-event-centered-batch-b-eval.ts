import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  MAX_BATCH_B_MODEL_CONCURRENCY,
  createBatchBEvaluationCheckpoint,
  formatBatchBEvaluationHumanReviewPackage,
  formatBatchBEvaluationCheckpoint,
  formatBatchBEvaluationReport,
  parseBatchBEvaluationCheckpoint,
  runBatchBEvaluationReplay,
  selectBatchBEvaluationCases,
  type BatchBEvaluationMode
} from "../src/features/interview/event-centered/evaluation-runner";
import type { BatchBEvaluationSuite } from "../src/features/interview/event-centered/evaluation-catalog";

const ALL_SUITES: readonly BatchBEvaluationSuite[] = [
  "public_protocol",
  "feeling",
  "thought",
  "relationship",
  "action",
  "safety"
];

function argumentValue(name: string) {
  const argument = process.argv.find((item) => item.startsWith(`${name}=`));
  if (argument) return argument.slice(name.length + 1) || null;
  const index = process.argv.indexOf(name);
  const next = index >= 0 ? process.argv[index + 1] : null;
  return next && !next.startsWith("--") ? next : null;
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseConcurrency(value: string | null) {
  if (value === null) return 1;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_BATCH_B_MODEL_CONCURRENCY) {
    throw new Error(`--concurrency 需要是 1 到 ${MAX_BATCH_B_MODEL_CONCURRENCY} 之间的整数。`);
  }
  return parsed;
}

async function writeCheckpointAtomically(path: string, checkpoint: Parameters<typeof formatBatchBEvaluationCheckpoint>[0]) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${formatBatchBEvaluationCheckpoint(checkpoint)}\n`, "utf8");
  await rename(temporaryPath, path);
}

function createCheckpointWriter(path: string) {
  let pendingWrite = Promise.resolve();
  return (checkpoint: Parameters<typeof formatBatchBEvaluationCheckpoint>[0]) => {
    const currentWrite = pendingWrite.then(() => writeCheckpointAtomically(path, checkpoint));
    // 后续案例即使遇到一次写入失败，也能按它们各自的结果继续完成自己的写入承诺。
    pendingWrite = currentWrite.catch(() => undefined);
    return currentWrite;
  };
}

async function readCheckpoint(path: string) {
  try {
    return parseBatchBEvaluationCheckpoint(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "未知读取错误";
    throw new Error(`无法读取 checkpoint ${path}：${reason}`);
  }
}

async function ensureNewCheckpointPath(path: string) {
  try {
    await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`checkpoint 已存在：${path}。如需继续该运行，请追加 --resume；如需新运行，请换一个 checkpoint 路径。`);
}

const mode = (argumentValue("--mode") ?? "rules") as BatchBEvaluationMode;
if (mode !== "rules" && mode !== "model") {
  throw new Error("--mode 仅支持 rules 或 model。");
}

const requestedSuites = argumentValue("--suites")?.split(",").filter(Boolean) ?? ALL_SUITES;
const suites = requestedSuites.filter((suite): suite is BatchBEvaluationSuite => ALL_SUITES.includes(suite as BatchBEvaluationSuite));
if (!suites.length || suites.length !== requestedSuites.length) {
  throw new Error(`--suites 仅支持：${ALL_SUITES.join(", ")}`);
}

const wantsAll = process.argv.includes("--all");
const confirmedFullModelReplay = process.argv.includes("--confirm-full-model-replay");
if (mode === "model" && wantsAll && !confirmedFullModelReplay) {
  throw new Error("全量模型回放会产生调用成本。请显式追加 --confirm-full-model-replay 后执行。");
}

const sampleSize = wantsAll ? null : parsePositiveInteger(argumentValue("--sample"), 24);
const seed = parsePositiveInteger(argumentValue("--seed"), 20_260_722);
const concurrencyArgument = argumentValue("--concurrency");
if (process.argv.includes("--concurrency") && !concurrencyArgument) {
  throw new Error("--concurrency 需要提供正整数。");
}
const concurrency = parseConcurrency(concurrencyArgument);
if (mode !== "model" && concurrency !== 1) {
  throw new Error("--concurrency 仅适用于 model 模式；rules 模式保持串行目录预检。");
}
const checkpointPath = argumentValue("--checkpoint");
const wantsResume = process.argv.includes("--resume");
if (process.argv.includes("--checkpoint") && !checkpointPath) {
  throw new Error("--checkpoint 需要提供文件路径。");
}
if (wantsResume && !checkpointPath) {
  throw new Error("--resume 需要与 --checkpoint=<文件路径> 一起使用。");
}

const selected = selectBatchBEvaluationCases({ suites, sampleSize, seed });
const checkpoint = wantsResume && checkpointPath
  ? await readCheckpoint(checkpointPath)
  : checkpointPath
    ? await (async () => {
      await ensureNewCheckpointPath(checkpointPath);
      const initial = createBatchBEvaluationCheckpoint({
        mode,
        judgeEnabled: process.argv.includes("--judge"),
        concurrency,
        selected
      });
      await writeCheckpointAtomically(checkpointPath, initial);
      return initial;
    })()
    : null;
const writeCheckpoint = checkpointPath ? createCheckpointWriter(checkpointPath) : undefined;

const report = await runBatchBEvaluationReplay({
  mode,
  suites,
  sampleSize,
  seed,
  judge: process.argv.includes("--judge"),
  concurrency,
  checkpoint,
  onCheckpoint: writeCheckpoint
});
const output = formatBatchBEvaluationReport(report);
const outputPath = argumentValue("--output");
if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${output}\n`, "utf8");
}
const humanReviewOutputPath = argumentValue("--human-review-output");
if (process.argv.includes("--human-review-output") && !humanReviewOutputPath) {
  throw new Error("--human-review-output 需要提供 Markdown 文件路径。");
}
if (humanReviewOutputPath) {
  await mkdir(dirname(humanReviewOutputPath), { recursive: true });
  await writeFile(
    humanReviewOutputPath,
    `${formatBatchBEvaluationHumanReviewPackage(report)}\n`,
    "utf8"
  );
}
console.log(output);

if (mode === "model" && !report.qualityGate.eligible) {
  process.exitCode = 1;
}
