import {
  mainGi088CalibrationCli,
  safeGi088CalibrationErrorCode
} from "./run-gi088-calibration";

mainGi088CalibrationCli().catch((error: unknown) => {
  process.stderr.write(`${safeGi088CalibrationErrorCode(error)}\n`);
  process.exitCode = 1;
});
