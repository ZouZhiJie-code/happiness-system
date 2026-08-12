import {
  mainGi088RecordCardRewriteCli,
  safeGi088RecordCardRewriteErrorCode
} from "./run-gi088-record-card-rewrite";

mainGi088RecordCardRewriteCli().catch((error: unknown) => {
  process.stderr.write(`${safeGi088RecordCardRewriteErrorCode(error)}\n`);
  process.exitCode = 1;
});
