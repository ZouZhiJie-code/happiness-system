import {
  mainGi088DailyContinuationCli,
  safeGi088DailyContinuationErrorCode
} from "./run-gi088-daily-continuation";

mainGi088DailyContinuationCli().catch((error: unknown) => {
  process.stderr.write(`${safeGi088DailyContinuationErrorCode(error)}\n`);
  process.exitCode = 1;
});
