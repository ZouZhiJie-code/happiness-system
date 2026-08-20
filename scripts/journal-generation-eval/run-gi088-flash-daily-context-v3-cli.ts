import {
  mainGi088FlashDailyContextV3Cli,
  safeGi088FlashDailyContextV3ErrorCode
} from "./run-gi088-flash-daily-context-v3";

mainGi088FlashDailyContextV3Cli().catch((error: unknown) => {
  process.stderr.write(`${safeGi088FlashDailyContextV3ErrorCode(error)}\n`);
  process.exitCode = 1;
});
