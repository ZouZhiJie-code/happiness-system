import {
  mainGi088RecordCardRewriteV2Cli,
  safeGi088RecordCardRewriteV2ErrorCode
} from "./run-gi088-record-card-rewrite-v2";

mainGi088RecordCardRewriteV2Cli().catch((error: unknown) => {
  process.stderr.write(`${safeGi088RecordCardRewriteV2ErrorCode(error)}\n`);
  process.exitCode = 1;
});
