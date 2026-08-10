import { runBoard7bSemanticFrameV1Regression } from "./run-board7b-semantic-frame-v1-regression";

runBoard7bSemanticFrameV1Regression().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
