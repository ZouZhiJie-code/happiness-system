import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createGi088ResponseFirstResponsibilityAudit,
  createGi088ResponseFirstTwoStageCandidateIdentity
} from "../evals/event-centered-generative/gi088-response-first-two-stage-v1/candidate";
import { toGi088ResponseLatencyContractAbTurnInput } from "./prepare-gi088-response-latency-contract-ab";
import type { Gi088RealProblemRegressionCase } from "./prepare-gi088-real-problem-regression";

const CASE_ID = "RPR-CF-02";
const PRIVATE_CASES =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/.private/real-problem-regression-v1.2/regression-cases.json";

const cases = JSON.parse(
  await readFile(path.join(process.cwd(), PRIVATE_CASES), "utf8")
) as Gi088RealProblemRegressionCase[];
const item = cases.find((candidate) => candidate.caseId === CASE_ID);
if (!item) throw new Error("GI088_RESPONSE_FIRST_AUDIT_CASE_MISSING");

const audit = createGi088ResponseFirstResponsibilityAudit(
  toGi088ResponseLatencyContractAbTurnInput(item)
);
if (!("inputProjection" in audit)) {
  throw new Error("GI088_RESPONSE_FIRST_INPUT_PROJECTION_MISSING");
}

process.stdout.write(`${JSON.stringify({
  schemaVersion: "1.0",
  identity: createGi088ResponseFirstTwoStageCandidateIdentity(),
  case: {
    caseId: item.caseId,
    caseFingerprint: item.caseFingerprint,
    candidateInputFingerprint: item.candidateInputFingerprint
  },
  inputProjection: audit.inputProjection,
  publicContentBoundary: "counts_and_fingerprints_only",
  modelCalls: 0
}, null, 2)}\n`);
