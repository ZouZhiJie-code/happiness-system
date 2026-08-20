import {
  deterministicInsufficientEvidenceNarrative,
  type MonthlyInsightCandidateInput
} from "@/features/analysis/monthly-insight-input";
import type { AnalysisNarrative } from "@/features/analysis/types";
import {
  MonthlyInsightContractError,
  parseMonthlyInsightCandidateOutput
} from "../../evals/monthly-insight-v1/contract";

export type MonthlyInsightEvalVerdict = "pass" | "minor" | "fail";
export type MonthlyInsightEvalCaseKind = "synthetic" | "private";
export type MonthlyInsightEvalCaseStatus =
  | "deterministic_zero_call"
  | "completed"
  | "reviewed"
  | "contract_failed"
  | "generation_failed"
  | "not_run";

export interface MonthlyInsightEvalCase {
  id: string;
  kind: MonthlyInsightEvalCaseKind;
  input: MonthlyInsightCandidateInput;
}

export interface MonthlyInsightEvalReview {
  verdict: MonthlyInsightEvalVerdict;
  blockers: string[];
}

export interface MonthlyInsightEvalCaseResult {
  id: string;
  kind: MonthlyInsightEvalCaseKind;
  status: MonthlyInsightEvalCaseStatus;
  output: AnalysisNarrative | null;
  review: MonthlyInsightEvalReview | null;
  errorCode: string | null;
  stopReason: string | null;
}

export interface MonthlyInsightCallLedgerEntry {
  caseId: string;
  attempt: 1;
  maxTokens: 1200;
  status: "completed" | "failed";
}

export interface MonthlyInsightEvalRunResult {
  cases: MonthlyInsightEvalCaseResult[];
  callLedger: MonthlyInsightCallLedgerEntry[];
}

export interface MonthlyInsightEvalRunnerDependencies {
  generate: (
    input: MonthlyInsightCandidateInput,
    options: { maxTokens: 1200 }
  ) => Promise<unknown> | unknown;
  review?: (
    caseId: string,
    output: AnalysisNarrative
  ) => Promise<MonthlyInsightEvalReview> | MonthlyInsightEvalReview;
}

const MAX_CALLS = 12;
const MAX_TOKENS = 1200 as const;

function notRunResult(
  evalCase: MonthlyInsightEvalCase,
  stopReason: string
): MonthlyInsightEvalCaseResult {
  return {
    id: evalCase.id,
    kind: evalCase.kind,
    status: "not_run",
    output: null,
    review: null,
    errorCode: null,
    stopReason
  };
}

export function createMonthlyInsightEvalRunner(
  dependencies: MonthlyInsightEvalRunnerDependencies
) {
  return {
    async run(cases: MonthlyInsightEvalCase[]): Promise<MonthlyInsightEvalRunResult> {
      const results: MonthlyInsightEvalCaseResult[] = [];
      const callLedger: MonthlyInsightCallLedgerEntry[] = [];
      let stopReason: string | null = null;
      let privateCasesAttempted = 0;

      for (const evalCase of cases) {
        if (stopReason) {
          results.push(notRunResult(evalCase, stopReason));
          continue;
        }

        if (!evalCase.input.eligibility.eligible) {
          results.push({
            id: evalCase.id,
            kind: evalCase.kind,
            status: "deterministic_zero_call",
            output: deterministicInsufficientEvidenceNarrative(evalCase.input),
            review: null,
            errorCode: null,
            stopReason: null
          });
          continue;
        }

        if (callLedger.length >= MAX_CALLS) {
          stopReason = "CALL_BUDGET_EXHAUSTED";
          results.push(notRunResult(evalCase, stopReason));
          continue;
        }

        if (evalCase.kind === "private") {
          privateCasesAttempted += 1;
        }

        try {
          const rawOutput = await dependencies.generate(evalCase.input, { maxTokens: MAX_TOKENS });
          callLedger.push({
            caseId: evalCase.id,
            attempt: 1,
            maxTokens: MAX_TOKENS,
            status: "completed"
          });
          const output = parseMonthlyInsightCandidateOutput(evalCase.input, rawOutput);
          const review = dependencies.review
            ? await dependencies.review(evalCase.id, output)
            : null;
          results.push({
            id: evalCase.id,
            kind: evalCase.kind,
            status: review ? "reviewed" : "completed",
            output,
            review,
            errorCode: null,
            stopReason: null
          });

          if (
            evalCase.kind === "private"
            && privateCasesAttempted <= 3
            && review
            && review.blockers.length > 0
          ) {
            stopReason = `PRIVATE_BLOCKER:${evalCase.id}`;
          }
        } catch (error) {
          if (!callLedger.some((entry) => entry.caseId === evalCase.id)) {
            callLedger.push({
              caseId: evalCase.id,
              attempt: 1,
              maxTokens: MAX_TOKENS,
              status: "failed"
            });
          }
          const contractFailure = error instanceof MonthlyInsightContractError;
          results.push({
            id: evalCase.id,
            kind: evalCase.kind,
            status: contractFailure ? "contract_failed" : "generation_failed",
            output: null,
            review: null,
            errorCode: contractFailure ? "OUTPUT_CONTRACT_FAILED" : "GENERATION_FAILED",
            stopReason: null
          });
          if (evalCase.kind === "private" && privateCasesAttempted <= 3) {
            stopReason = contractFailure
              ? `PRIVATE_CONTRACT_BLOCKER:${evalCase.id}`
              : `PRIVATE_TECHNICAL_FAILURE:${evalCase.id}`;
          }
        }
      }

      return { cases: results, callLedger };
    }
  };
}

export interface MonthlyInsightDecisionReview {
  id: string;
  verdict: MonthlyInsightEvalVerdict;
  blockers: string[];
}

export interface MonthlyInsightDecisionInput {
  synthetic: MonthlyInsightDecisionReview[];
  real: MonthlyInsightDecisionReview[];
}

export interface MonthlyInsightDecision {
  decision: "Go" | "No-Go";
  reason:
    | "threshold_met"
    | "insufficient_evidence"
    | "blocker_present"
    | "synthetic_boundary_failed"
    | "real_quality_failed"
    | "real_pass_threshold_not_met";
}

export function decideMonthlyInsightGoNoGo({
  synthetic,
  real
}: MonthlyInsightDecisionInput): MonthlyInsightDecision {
  if ([...synthetic, ...real].some((review) => review.blockers.length > 0)) {
    return { decision: "No-Go", reason: "blocker_present" };
  }
  if (synthetic.length !== 6 || synthetic.some((review) => review.verdict !== "pass")) {
    return { decision: "No-Go", reason: "synthetic_boundary_failed" };
  }
  if (real.length < 4) {
    return { decision: "No-Go", reason: "insufficient_evidence" };
  }
  if (real.some((review) => !["pass", "minor"].includes(review.verdict))) {
    return { decision: "No-Go", reason: "real_quality_failed" };
  }
  if (real.filter((review) => review.verdict === "pass").length < 4) {
    return { decision: "No-Go", reason: "real_pass_threshold_not_met" };
  }
  return { decision: "Go", reason: "threshold_met" };
}
