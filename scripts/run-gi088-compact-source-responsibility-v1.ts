import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  stat,
  unlink
} from "node:fs/promises";
import { resolve } from "node:path";

import { GI088_V8R3_DEVELOPMENT_CASES } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import { createGi088CanonicalV2StateAdapter } from "../evals/event-centered-generative/gi088-pro-contract-projection-ab/state-adapter";
import {
  readGi088ProContractPrivateReport,
  type Gi088ProContractDevelopmentReport
} from "../evals/event-centered-generative/gi088-pro-contract-projection-ab/runner";
import {
  GI088_COMPACT_SOURCE_RESPONSIBILITY_CANDIDATE_FINGERPRINT,
  GI088_COMPACT_SOURCE_RESPONSIBILITY_PARENT_REPORT_SHA256,
  createGi088CompactSourceResponsibilityPublicSummary,
  createGi088CompactSourceResponsibilityReport,
  serializeGi088CompactSourceResponsibilityArtifact
} from "../evals/event-centered-generative/gi088-compact-source-responsibility-v1/replay";
import { createGi088FingerprintBundle } from "../src/server/services/evaluation/gi088/candidate";
import {
  GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH
} from "../src/server/services/evaluation/gi088/pro-contract-review-contract";

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_PRIVATE_ROOT = resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-13-gi088-compact-source-responsibility-v1"
);

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_PRIVATE_REPORT_PATH = resolve(
  GI088_COMPACT_SOURCE_RESPONSIBILITY_PRIVATE_ROOT,
  "source-responsibility-private-report.json"
);

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_PUBLIC_SUMMARY_PATH = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-13-gi088-compact-source-responsibility-v1/gi088-compact-source-responsibility-summary.json"
);

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function runtimeFingerprints() {
  const bundle = createGi088FingerprintBundle();
  return {
    candidateFingerprint: bundle.candidateFingerprint,
    datasetFingerprint: bundle.datasetFingerprint,
    runnerFingerprint: bundle.runnerFingerprint,
    experienceFingerprint: bundle.experienceFingerprint,
    executionFingerprint: bundle.executionFingerprint
  };
}

async function assertTargetAvailable(path: string) {
  try {
    await stat(path);
    throw new Error("GI088_SOURCE_RESPONSIBILITY_ARTIFACT_ALREADY_EXISTS");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function writeExclusive(input: {
  path: string;
  bytes: string;
  mode: number;
}) {
  await mkdir(resolve(input.path, ".."), {
    recursive: true,
    mode: input.mode === 0o600 ? 0o700 : 0o755
  });
  const handle = await open(input.path, "wx", input.mode);
  try {
    await handle.writeFile(input.bytes, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(input.path, input.mode);
}

async function writeArtifactPair(input: {
  privateBytes: string;
  publicBytes: string;
}) {
  await assertTargetAvailable(
    GI088_COMPACT_SOURCE_RESPONSIBILITY_PRIVATE_REPORT_PATH
  );
  await assertTargetAvailable(
    GI088_COMPACT_SOURCE_RESPONSIBILITY_PUBLIC_SUMMARY_PATH
  );
  await writeExclusive({
    path: GI088_COMPACT_SOURCE_RESPONSIBILITY_PRIVATE_REPORT_PATH,
    bytes: input.privateBytes,
    mode: 0o600
  });
  try {
    await writeExclusive({
      path: GI088_COMPACT_SOURCE_RESPONSIBILITY_PUBLIC_SUMMARY_PATH,
      bytes: input.publicBytes,
      mode: 0o644
    });
  } catch (error) {
    await unlink(
      GI088_COMPACT_SOURCE_RESPONSIBILITY_PRIVATE_REPORT_PATH
    ).catch(() => undefined);
    throw error;
  }
}

export async function runGi088CompactSourceResponsibilityReplay(input?: {
  createdAt?: string;
}) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error("GI088_SOURCE_RESPONSIBILITY_PRODUCTION_FORBIDDEN");
  }
  const parentBytes = await readFile(
    GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH
  );
  const parentReportSha256 = sha256(parentBytes);
  if (
    parentReportSha256 !==
    GI088_COMPACT_SOURCE_RESPONSIBILITY_PARENT_REPORT_SHA256
  ) {
    throw new Error("GI088_SOURCE_RESPONSIBILITY_PARENT_SHA256_MISMATCH");
  }
  const parentUnknown = await readGi088ProContractPrivateReport(
    GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH
  );
  if (parentUnknown.partition !== "development") {
    throw new Error("GI088_SOURCE_RESPONSIBILITY_PARENT_STAGE_INVALID");
  }
  const parentReport = parentUnknown as Gi088ProContractDevelopmentReport;
  const createdAt = input?.createdAt ?? new Date().toISOString();
  const runtimeFingerprintsBefore = runtimeFingerprints();
  createGi088CompactSourceResponsibilityReport({
    parentReport,
    parentReportSha256,
    cases: GI088_V8R3_DEVELOPMENT_CASES,
    adapter: createGi088CanonicalV2StateAdapter(),
    runtimeFingerprintsBefore,
    runtimeFingerprintsAfter: runtimeFingerprintsBefore,
    createdAt
  });
  const runtimeFingerprintsAfter = runtimeFingerprints();
  const report = createGi088CompactSourceResponsibilityReport({
    parentReport,
    parentReportSha256,
    cases: GI088_V8R3_DEVELOPMENT_CASES,
    adapter: createGi088CanonicalV2StateAdapter(),
    runtimeFingerprintsBefore,
    runtimeFingerprintsAfter,
    createdAt
  });
  const privateBytes = serializeGi088CompactSourceResponsibilityArtifact(report);
  const privateReportSha256 = sha256(privateBytes);
  const publicSummary = createGi088CompactSourceResponsibilityPublicSummary({
    report,
    privateReportSha256
  });
  const publicBytes =
    serializeGi088CompactSourceResponsibilityArtifact(publicSummary);
  await writeArtifactPair({ privateBytes, publicBytes });
  return {
    report,
    publicSummary,
    privateReportSha256,
    publicSummarySha256: sha256(publicBytes),
    privateReportPath:
      GI088_COMPACT_SOURCE_RESPONSIBILITY_PRIVATE_REPORT_PATH,
    publicSummaryPath:
      GI088_COMPACT_SOURCE_RESPONSIBILITY_PUBLIC_SUMMARY_PATH
  };
}

async function main() {
  if (!process.argv.includes("--run")) {
    process.stdout.write(`${JSON.stringify({
      candidateFingerprint:
        GI088_COMPACT_SOURCE_RESPONSIBILITY_CANDIDATE_FINGERPRINT,
      parentReportSha256:
        GI088_COMPACT_SOURCE_RESPONSIBILITY_PARENT_REPORT_SHA256,
      providerCalls: 0,
      judgeCalls: 0,
      hiddenDatasetReads: 0,
      privateReportPath:
        GI088_COMPACT_SOURCE_RESPONSIBILITY_PRIVATE_REPORT_PATH,
      publicSummaryPath:
        GI088_COMPACT_SOURCE_RESPONSIBILITY_PUBLIC_SUMMARY_PATH
    }, null, 2)}\n`);
    return;
  }
  const result = await runGi088CompactSourceResponsibilityReplay();
  process.stdout.write(`${JSON.stringify({
    candidateVersion: result.report.candidateVersion,
    candidateFingerprint: result.report.candidateFingerprint,
    reportFingerprint: result.report.reportFingerprint,
    privateReportSha256: result.privateReportSha256,
    publicSummarySha256: result.publicSummarySha256,
    budget: result.report.budget,
    summary: result.report.summary,
    decision: result.report.decision,
    privateReportPath: result.privateReportPath,
    publicSummaryPath: result.publicSummaryPath
  }, null, 2)}\n`);
}

if (process.argv.includes("--run")) await main();
