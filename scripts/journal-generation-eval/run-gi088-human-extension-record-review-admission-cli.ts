import {
  mainGi088ExtensionRecordReviewAdmissionCli,
  safeGi088ExtensionRecordReviewAdmissionErrorCode
} from "./run-gi088-human-extension-record-review-admission";

mainGi088ExtensionRecordReviewAdmissionCli().catch((error: unknown) => {
  process.stderr.write(`${safeGi088ExtensionRecordReviewAdmissionErrorCode(error)}\n`);
  process.exitCode = 1;
});
