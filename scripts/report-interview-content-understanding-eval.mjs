import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportDir = join(root, "evals/interview-content-understanding/reports");
const vitestBin = join(root, "node_modules/vitest/vitest.mjs");
const testFiles = [
  "tests/evals/interview-content-understanding.eval.test.ts",
  "tests/evals/interview-content-understanding-v2.eval.test.ts"
];

mkdirSync(reportDir, { recursive: true });

function runEvaluation(index) {
  const result = spawnSync(
    process.execPath,
    [vitestBin, "run", ...testFiles, "--reporter=json"],
    {
      cwd: root,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 16 * 1024 * 1024
    }
  );

  if (!result.stdout.trim()) {
    throw new Error(result.stderr || `第 ${index} 次评测没有产生结果`);
  }

  const output = JSON.parse(result.stdout);
  const failedTests = (output.testResults ?? [])
    .flatMap((suite) => suite.assertionResults ?? [])
    .filter((test) => test.status === "failed")
    .map((test) => ({
      title: test.fullName ?? test.title,
      failureMessages: test.failureMessages ?? []
    }));
  const summary = {
    run: index,
    generatedAt: new Date().toISOString(),
    success: result.status === 0 && output.success === true,
    testFiles: output.numTotalTestSuites,
    passedTestFiles: output.numPassedTestSuites,
    failedTestFiles: output.numFailedTestSuites,
    checks: output.numTotalTests,
    passedChecks: output.numPassedTests,
    failedChecks: output.numFailedTests,
    failedTests
  };

  writeFileSync(
    join(reportDir, `run-${index}.json`),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8"
  );
  return summary;
}

const runs = [1, 2, 3].map(runEvaluation);
const stable = runs.every((run) => run.success);
const report = {
  reportVersion: "turn-understanding-v2-offline-stability-v1",
  generatedAt: new Date().toISOString(),
  dataset: {
    existingContentCases: 120,
    newExecutableCases: 40,
    intentCases: 120,
    totalSpecializedCases: 280
  },
  stable,
  runs
};

writeFileSync(
  join(reportDir, "latest-summary.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
writeFileSync(
  join(reportDir, "latest-summary.md"),
  [
    "# 本轮理解与事实更新离线稳定性报告",
    "",
    `- 生成时间：${report.generatedAt}`,
    `- 专项案例：280 条（意图 120 条、原内容理解 120 条、新增可执行 40 条）`,
    `- 连续运行：3 次`,
    `- 稳定结果：${stable ? "通过" : "未通过"}`,
    "",
    "| 次数 | 检查项 | 通过 | 失败 | 结果 |",
    "|---:|---:|---:|---:|---|",
    ...runs.map((run) =>
      `| ${run.run} | ${run.checks} | ${run.passedChecks} | ${run.failedChecks} | ${run.success ? "通过" : "未通过"} |`
    ),
    ""
  ].join("\n"),
  "utf8"
);

process.stdout.write(`${readFileSync(join(reportDir, "latest-summary.md"), "utf8")}\n`);
if (!stable) process.exitCode = 1;
