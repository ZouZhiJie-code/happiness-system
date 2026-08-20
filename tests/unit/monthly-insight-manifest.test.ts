import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import manifest from "../../evals/monthly-insight-v1/manifest.json";

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(resolve(process.cwd(), path))).digest("hex");
}

describe("monthly insight frozen candidate manifest", () => {
  it("matches every execution-relevant public asset", () => {
    expect(manifest.hashes).toEqual({
      promptSha256: sha256("evals/monthly-insight-v1/prompt.md"),
      skillSha256: sha256("evals/monthly-insight-v1/skill.md"),
      contractSha256: sha256("evals/monthly-insight-v1/contract.ts"),
      syntheticDatasetSha256: sha256("evals/monthly-insight-v1/synthetic-cases.json"),
      inputProjectionSha256: sha256("src/features/analysis/monthly-insight-input.ts"),
      currentProductLoaderSha256: sha256("src/server/services/analysis/monthly-insight-candidate.service.ts"),
      runnerSha256: sha256("scripts/monthly-insight-eval/runner.ts")
    });
  });
});
