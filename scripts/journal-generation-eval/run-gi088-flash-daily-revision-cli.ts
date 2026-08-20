import {
  mainGi088FlashDailyRevisionCli,
  safeGi088FlashDailyRevisionErrorCode
} from "./run-gi088-flash-daily-revision";

mainGi088FlashDailyRevisionCli().catch((error: unknown) => {
  process.stderr.write(`${safeGi088FlashDailyRevisionErrorCode(error)}\n`);
  process.exitCode = 1;
});
