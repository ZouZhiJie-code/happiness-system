import {
  mainGi088ExtensionRecordCli,
  safeGi088ExtensionRecordErrorCode
} from "./run-gi088-human-extension-records";

mainGi088ExtensionRecordCli().catch((error: unknown) => {
  process.stderr.write(`${safeGi088ExtensionRecordErrorCode(error)}\n`);
  process.exitCode = 1;
});
