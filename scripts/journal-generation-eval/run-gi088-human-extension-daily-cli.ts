import {
  mainGi088ExtensionDailyCli,
  safeGi088ExtensionDailyErrorCode
} from "./run-gi088-human-extension-daily";

mainGi088ExtensionDailyCli().catch((error: unknown) => {
  process.stderr.write(`${safeGi088ExtensionDailyErrorCode(error)}\n`);
  process.exitCode = 1;
});
