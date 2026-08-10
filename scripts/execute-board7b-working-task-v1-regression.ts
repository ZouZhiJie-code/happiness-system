import {
  retryBoard7bWorkingTaskV1TechnicalFailure,
  runBoard7bWorkingTaskV1Regression
} from "./run-board7b-working-task-v1-regression";

function retryCaseId() {
  const inline = process.argv.find((value) => value.startsWith("--retry-case="));
  if (inline) return inline.slice("--retry-case=".length).trim();
  const index = process.argv.indexOf("--retry-case");
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

const caseId = retryCaseId();
const execution = caseId
  ? retryBoard7bWorkingTaskV1TechnicalFailure(caseId)
  : runBoard7bWorkingTaskV1Regression();

execution.catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
