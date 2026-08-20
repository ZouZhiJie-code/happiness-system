import {
  mainGi088RecordCardRewriteV3Cli,
  safeGi088RecordCardRewriteV3ErrorCode
} from "./run-gi088-record-card-rewrite-v3";

mainGi088RecordCardRewriteV3Cli().catch((error: unknown) => {
  process.stderr.write(`${safeGi088RecordCardRewriteV3ErrorCode(error)}\n`);
  process.exitCode = 1;
});
