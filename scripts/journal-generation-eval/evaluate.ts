import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateDataset } from "./static-evaluator";
import type { JournalEvaluationDataset } from "./types";

interface EvaluateCliOptions {
  input: string;
  output: string | null;
}

export function parseEvaluateArgs(argv: string[]): EvaluateCliOptions {
  const defaultInput = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../artifacts/journal-generation-evaluation/seed-cases.json"
  );
  const options: EvaluateCliOptions = { input: defaultInput, output: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input" && argv[index + 1]) {
      options.input = resolve(argv[index + 1]);
      index += 1;
    } else if (argument === "--output" && argv[index + 1]) {
      options.output = resolve(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }
  return options;
}

export async function runStaticEvaluation(options: EvaluateCliOptions) {
  const dataset = JSON.parse(await readFile(options.input, "utf8")) as JournalEvaluationDataset;
  const report = evaluateDataset(dataset);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;

  if (options.output) {
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, serialized, "utf8");
  }

  return { report, serialized };
}

async function main() {
  const options = parseEvaluateArgs(process.argv.slice(2));
  const { report, serialized } = await runStaticEvaluation(options);
  if (options.output) {
    process.stdout.write(
      `静态评测完成：${report.case_count} 个案例，${report.admitted_candidate_count}/${report.candidate_count} 个候选通过硬门。\n`
    );
  } else {
    process.stdout.write(serialized);
  }
}

const isCli = process.argv[1]
  && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url));
if (isCli) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
