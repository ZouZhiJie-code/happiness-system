import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertLocalJournalEvaluationEnvironment,
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/private-loader";
import type {
  Gi088EmptyRecoveryFailureCategory,
  Gi088EmptyRecoveryVerdict
} from "@/app/admin/journal-evaluation/empty-recovery-review-loader";
import { GI088_V8R3_DEVELOPMENT_CASES } from "../../../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import {
  GI088_RUNTIME_CONTRACT_GROUP_ORDER,
  type Gi088RuntimeContractGroup
} from "../../../../evals/event-centered-generative/gi088-runtime-contract-root-cause/contracts";
import {
  GI088_RUNTIME_CONTRACT_PRIVATE_REPORT_PATH,
  createGi088RuntimeContractReviewSource,
  readGi088RuntimeContractDiagnosticReport,
  type Gi088RuntimeContractDiagnosticReport,
  type Gi088RuntimeContractGroupSummary
} from "../../../../evals/event-centered-generative/gi088-runtime-contract-root-cause/runner";

export { isLocalJournalEvaluationEnabled, isLocalJournalEvaluationRequest };

export const GI088_RUNTIME_CONTRACT_REVIEW_TOOL_VERSION =
  "2026-08-12.gi088-runtime-contract-final-eight-review-v1" as const;
export const GI088_RUNTIME_CONTRACT_REVIEW_STAGE =
  "runtime-contract-final-eight" as const;

const PRIVATE_ROOT = resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-12-gi088-runtime-contract-root-cause-diagnostic-v1/runtime-contract-final-eight-review"
);

const TOOL_SOURCE_PATHS = [
  "scripts/run-gi088-runtime-contract-final-eight-review.ts",
  "src/app/admin/journal-evaluation/adaptive-recovery/runtime-contract-final-eight/page.tsx",
  "src/app/admin/journal-evaluation/runtime-contract-final-eight-loader.ts",
  "src/components/journal-evaluation/runtime-contract-final-eight-workbench.tsx",
  "src/app/api/local/gi088-v8r3/runtime-contract-final-eight/session/route.ts",
  "src/app/api/local/gi088-v8r3/runtime-contract-final-eight/draft/route.ts",
  "src/app/api/local/gi088-v8r3/runtime-contract-final-eight/finalize/route.ts"
] as const;

type ReviewMessage = { role: "user" | "assistant"; content: string };
type ReviewSide = "left" | "right";

export type Gi088RuntimeContractReviewCandidate = {
  side: ReviewSide;
  available: boolean;
  understanding: string | null;
  response: string;
  contentSha256: string;
};

export type Gi088RuntimeContractReviewCard = {
  publicId: string;
  label: string;
  workingTask: string;
  messages: ReviewMessage[];
  left: Gi088RuntimeContractReviewCandidate;
  right: Gi088RuntimeContractReviewCandidate | null;
  contentSha256: string;
};

export type Gi088RuntimeContractCandidateDecision = {
  verdict: Gi088EmptyRecoveryVerdict;
  failureCategory: Gi088EmptyRecoveryFailureCategory | null;
  reason: string;
  singleCaseBlocker: boolean;
};

export type Gi088RuntimeContractReviewDecisionV1 = {
  publicId: string;
  left: Gi088RuntimeContractCandidateDecision;
  right: Gi088RuntimeContractCandidateDecision | null;
  preferredSide: ReviewSide | null;
  reviewer: "product_owner";
  updatedAt: string;
};

export type Gi088RuntimeContractReviewGroupResult = {
  group: Gi088RuntimeContractGroup;
  identity: Gi088RuntimeContractGroupSummary["identity"];
  directUseCount: number;
  minorIssueCount: number;
  qualityFailureCount: number;
  singleCaseBlockerCount: number;
  pairedWinCount: number;
  technicalEffectiveValidCount: number;
  technicalP90Ms: number | null;
  gatePassed: boolean;
};

export type Gi088RuntimeContractReviewReceiptV1 = {
  schemaVersion: "1.0";
  toolVersion: typeof GI088_RUNTIME_CONTRACT_REVIEW_TOOL_VERSION;
  stage: typeof GI088_RUNTIME_CONTRACT_REVIEW_STAGE;
  status: "sealed";
  reportFingerprint: string;
  diagnosticFingerprint: string;
  reviewCount: 8;
  responseCount: 8 | 16;
  decisionCount: 8;
  sourceReportSha256: string;
  toolSourceSha256: string;
  bundleSha256: string;
  decisionsSha256: string;
  receiptSha256: string;
  groupResults: Gi088RuntimeContractReviewGroupResult[];
  winningGroup: Gi088RuntimeContractGroup | null;
  gate: {
    passed: boolean;
    requiredDirectUseMinimum: 6;
    allowedMinorIssueMaximum: 2;
    allowedQualityFailureMaximum: 0;
    allowedSingleCaseBlockerMaximum: 0;
  };
  reviewer: "product_owner";
  finalizedAt: string;
  modelCalls: 0;
  databaseWrites: 0;
  externalUploads: 0;
  telemetryEvents: 0;
};

export type Gi088RuntimeContractReviewBundleV1 = {
  schemaVersion: "1.0";
  toolVersion: typeof GI088_RUNTIME_CONTRACT_REVIEW_TOOL_VERSION;
  stage: typeof GI088_RUNTIME_CONTRACT_REVIEW_STAGE;
  presentationMode: "absolute" | "paired";
  sourceReportSha256: string;
  toolSourceSha256: string;
  bundleSha256: string;
  cards: Gi088RuntimeContractReviewCard[];
  decisions: Gi088RuntimeContractReviewDecisionV1[];
  receipt: Gi088RuntimeContractReviewReceiptV1 | null;
};

type HiddenCandidate = {
  publicId: string;
  side: ReviewSide;
  group: Gi088RuntimeContractGroup;
  available: boolean;
  requestHash: string;
  responseHash: string | null;
};

type Material = {
  report: Gi088RuntimeContractDiagnosticReport;
  sourceReportSha256: string;
  cards: Gi088RuntimeContractReviewCard[];
  hiddenCandidates: HiddenCandidate[];
  summaries: Gi088RuntimeContractGroupSummary[];
};

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

async function computeToolSourceSha256() {
  const entries = await Promise.all(TOOL_SOURCE_PATHS.map(async (path) => ({
    path,
    sha256: sha256(await readFile(resolve(process.cwd(), path)))
  })));
  return sha256(stableJson(entries));
}

async function optionalJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

async function atomicWrite(path: string, value: unknown, privateRoot: string) {
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const temporaryPath = resolve(
    privateRoot,
    `.${path.split("/").at(-1)}.${process.pid}.${Date.now()}.tmp`
  );
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

function validateCandidateDecision(
  input: Gi088RuntimeContractCandidateDecision,
  available: boolean
) {
  const categories: Gi088EmptyRecoveryFailureCategory[] = [
    "reasks_answered_content",
    "working_task_drift",
    "unsupported_third_party_inference",
    "low_information_gain",
    "answer_burden",
    "contract_or_data"
  ];
  const reason = input.reason.trim();
  if (!available) {
    if (
      input.verdict !== "quality_failure" ||
      input.failureCategory !== "contract_or_data" ||
      reason.length < 8 ||
      reason.length > 300
    ) {
      throw new Error("GI088_RUNTIME_CONTRACT_UNAVAILABLE_DECISION_INVALID");
    }
    return { ...input, reason };
  }
  if (input.verdict === "ready_to_use") {
    if (
      input.failureCategory !== null ||
      input.singleCaseBlocker ||
      reason.length > 0
    ) {
      throw new Error("GI088_RUNTIME_CONTRACT_READY_DECISION_INVALID");
    }
    return { ...input, reason: "" };
  }
  if (
    !categories.includes(input.failureCategory as Gi088EmptyRecoveryFailureCategory) ||
    reason.length < 8 ||
    reason.length > 300 ||
    (input.verdict !== "quality_failure" && input.singleCaseBlocker)
  ) {
    throw new Error("GI088_RUNTIME_CONTRACT_REVIEW_DECISION_INVALID");
  }
  return { ...input, reason };
}

function createPresentation(report: Gi088RuntimeContractDiagnosticReport) {
  const source = createGi088RuntimeContractReviewSource({
    report,
    cases: GI088_V8R3_DEVELOPMENT_CASES
  });
  if (
    !source ||
    source.items.length !== 8 ||
    source.shortlistedGroups.length < 1 ||
    source.shortlistedGroups.length > 2
  ) {
    throw new Error("GI088_RUNTIME_CONTRACT_REVIEW_NOT_AVAILABLE");
  }
  const orderedItems = [...source.items].sort((left, right) =>
    sha256(`${report.reportFingerprint}:${left.caseId}`).localeCompare(
      sha256(`${report.reportFingerprint}:${right.caseId}`)
    )
  );
  const hiddenCandidates: HiddenCandidate[] = [];
  const cards = orderedItems.map((item, index) => {
    const publicId = sha256(
      `${report.reportFingerprint}:${item.caseId}`
    ).slice(0, 20);
    const orderedCandidates = [...item.candidates].sort((left, right) =>
      sha256(`${publicId}:${left.group}`).localeCompare(
        sha256(`${publicId}:${right.group}`)
      )
    );
    const candidates = orderedCandidates.map((candidate, candidateIndex) => {
      const side: ReviewSide = candidateIndex === 0 ? "left" : "right";
      hiddenCandidates.push({
        publicId,
        side,
        group: candidate.group,
        available: candidate.available,
        requestHash: candidate.requestHash,
        responseHash: candidate.responseHash
      });
      return {
        side,
        available: candidate.available,
        understanding: candidate.output.understanding,
        response: candidate.output.response,
        contentSha256: sha256(stableJson({
          understanding: candidate.output.understanding,
          response: candidate.output.response
        }))
      } satisfies Gi088RuntimeContractReviewCandidate;
    });
    const content = {
      workingTask: item.workingTask,
      messages: item.visibleConversation,
      candidates
    };
    return {
      publicId,
      label: `最终复核 ${String(index + 1).padStart(2, "0")}`,
      workingTask: item.workingTask,
      messages: item.visibleConversation,
      left: candidates[0]!,
      right: candidates[1] ?? null,
      contentSha256: sha256(stableJson(content))
    } satisfies Gi088RuntimeContractReviewCard;
  });
  return {
    cards,
    hiddenCandidates,
    summaries: source.groupSummaries,
    presentationMode: source.shortlistedGroups.length === 2
      ? "paired" as const
      : "absolute" as const
  };
}

export function createGi088RuntimeContractReviewService(input?: {
  reportPath?: string;
  privateRoot?: string;
  now?: () => string;
  toolSourceSha256?: string;
}) {
  const reportPath = input?.reportPath ?? GI088_RUNTIME_CONTRACT_PRIVATE_REPORT_PATH;
  const privateRoot = input?.privateRoot ?? PRIVATE_ROOT;
  const decisionsPath = resolve(privateRoot, "decisions.json");
  const receiptPath = resolve(privateRoot, "receipt.json");
  const now = input?.now ?? (() => new Date().toISOString());
  const toolSource = input?.toolSourceSha256
    ? async () => input.toolSourceSha256!
    : computeToolSourceSha256;

  async function material(): Promise<Material> {
    assertLocalJournalEvaluationEnvironment();
    const metadata = await stat(reportPath);
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
      throw new Error("GI088_RUNTIME_CONTRACT_SOURCE_REPORT_INVALID");
    }
    const sourceReportSha256 = sha256(await readFile(reportPath));
    const report = await readGi088RuntimeContractDiagnosticReport(reportPath);
    const presentation = createPresentation(report);
    return { report, sourceReportSha256, ...presentation };
  }

  async function decisions(current: Material) {
    const saved = await optionalJson<Gi088RuntimeContractReviewDecisionV1[]>(
      decisionsPath,
      []
    );
    const cards = new Map(current.cards.map((card) => [card.publicId, card]));
    if (
      !Array.isArray(saved) ||
      new Set(saved.map((item) => item.publicId)).size !== saved.length ||
      saved.some((item) => {
        const card = cards.get(item.publicId);
        if (!card || item.reviewer !== "product_owner") return true;
        try {
          validateCandidateDecision(item.left, card.left.available);
          if (card.right) {
            if (!item.right || !["left", "right"].includes(item.preferredSide ?? "")) {
              return true;
            }
            validateCandidateDecision(item.right, card.right.available);
          } else if (item.right !== null || item.preferredSide !== null) {
            return true;
          }
          return false;
        } catch {
          return true;
        }
      })
    ) {
      throw new Error("GI088_RUNTIME_CONTRACT_DECISIONS_INVALID");
    }
    return saved;
  }

  async function bundle() {
    const current = await material();
    const toolSourceSha256 = await toolSource();
    const bundleSha256 = sha256(stableJson({
      reportFingerprint: current.report.reportFingerprint,
      sourceReportSha256: current.sourceReportSha256,
      toolSourceSha256,
      cards: current.cards
    }));
    return { current, toolSourceSha256, bundleSha256 };
  }

  async function load(): Promise<Gi088RuntimeContractReviewBundleV1> {
    const { current, toolSourceSha256, bundleSha256 } = await bundle();
    const saved = await decisions(current);
    const receipt = await optionalJson<Gi088RuntimeContractReviewReceiptV1 | null>(
      receiptPath,
      null
    );
    if (
      receipt &&
      (receipt.toolVersion !== GI088_RUNTIME_CONTRACT_REVIEW_TOOL_VERSION ||
        receipt.stage !== GI088_RUNTIME_CONTRACT_REVIEW_STAGE ||
        receipt.reportFingerprint !== current.report.reportFingerprint ||
        receipt.sourceReportSha256 !== current.sourceReportSha256 ||
        receipt.toolSourceSha256 !== toolSourceSha256 ||
        receipt.bundleSha256 !== bundleSha256 ||
        !validHash(receipt.receiptSha256))
    ) {
      throw new Error("GI088_RUNTIME_CONTRACT_RECEIPT_SOURCE_MISMATCH");
    }
    return {
      schemaVersion: "1.0",
      toolVersion: GI088_RUNTIME_CONTRACT_REVIEW_TOOL_VERSION,
      stage: GI088_RUNTIME_CONTRACT_REVIEW_STAGE,
      presentationMode: current.cards[0]?.right ? "paired" : "absolute",
      sourceReportSha256: current.sourceReportSha256,
      toolSourceSha256,
      bundleSha256,
      cards: current.cards,
      decisions: saved,
      receipt
    };
  }

  async function saveDecision(inputDecision: {
    publicId: string;
    left: Gi088RuntimeContractCandidateDecision;
    right: Gi088RuntimeContractCandidateDecision | null;
    preferredSide: ReviewSide | null;
  }) {
    const { current } = await bundle();
    if (await optionalJson(receiptPath, null)) {
      throw new Error("GI088_RUNTIME_CONTRACT_RECEIPT_IMMUTABLE");
    }
    const card = current.cards.find((item) => item.publicId === inputDecision.publicId);
    if (!card) throw new Error("GI088_RUNTIME_CONTRACT_REVIEW_CARD_NOT_FOUND");
    const left = validateCandidateDecision(inputDecision.left, card.left.available);
    let right: Gi088RuntimeContractCandidateDecision | null = null;
    let preferredSide: ReviewSide | null = null;
    if (card.right) {
      if (!inputDecision.right || !["left", "right"].includes(inputDecision.preferredSide ?? "")) {
        throw new Error("GI088_RUNTIME_CONTRACT_PAIR_PREFERENCE_REQUIRED");
      }
      right = validateCandidateDecision(inputDecision.right, card.right.available);
      preferredSide = inputDecision.preferredSide;
    } else if (inputDecision.right !== null || inputDecision.preferredSide !== null) {
      throw new Error("GI088_RUNTIME_CONTRACT_ABSOLUTE_DECISION_INVALID");
    }
    const saved = await decisions(current);
    const next: Gi088RuntimeContractReviewDecisionV1 = {
      publicId: card.publicId,
      left,
      right,
      preferredSide,
      reviewer: "product_owner",
      updatedAt: now()
    };
    const updated = [
      ...saved.filter((item) => item.publicId !== card.publicId),
      next
    ].sort((a, b) =>
      current.cards.findIndex((item) => item.publicId === a.publicId) -
      current.cards.findIndex((item) => item.publicId === b.publicId)
    );
    await atomicWrite(decisionsPath, updated, privateRoot);
    return load();
  }

  async function finalize(): Promise<Gi088RuntimeContractReviewReceiptV1> {
    const existing = await optionalJson<Gi088RuntimeContractReviewReceiptV1 | null>(
      receiptPath,
      null
    );
    if (existing) return existing;
    const { current, toolSourceSha256, bundleSha256 } = await bundle();
    const saved = await decisions(current);
    if (saved.length !== 8 || current.cards.length !== 8) {
      throw new Error("GI088_RUNTIME_CONTRACT_REVIEW_INCOMPLETE");
    }
    const hidden = new Map(
      current.hiddenCandidates.map((item) => [`${item.publicId}:${item.side}`, item])
    );
    const resultMap = new Map<Gi088RuntimeContractGroup, {
      verdicts: Gi088EmptyRecoveryVerdict[];
      blockers: boolean[];
      pairedWins: number;
    }>();
    for (const summary of current.summaries) {
      resultMap.set(summary.group, { verdicts: [], blockers: [], pairedWins: 0 });
    }
    for (const decision of saved) {
      for (const side of ["left", "right"] as const) {
        const candidateDecision = decision[side];
        if (!candidateDecision) continue;
        const identity = hidden.get(`${decision.publicId}:${side}`);
        if (!identity) throw new Error("GI088_RUNTIME_CONTRACT_REVIEW_KEY_MISSING");
        const result = resultMap.get(identity.group)!;
        result.verdicts.push(candidateDecision.verdict);
        result.blockers.push(candidateDecision.singleCaseBlocker);
        if (decision.preferredSide === side) result.pairedWins += 1;
      }
    }
    const groupResults = current.summaries.map((summary) => {
      const result = resultMap.get(summary.group)!;
      const directUseCount = result.verdicts.filter(
        (value) => value === "ready_to_use"
      ).length;
      const minorIssueCount = result.verdicts.filter(
        (value) => value === "minor_issue"
      ).length;
      const qualityFailureCount = result.verdicts.filter(
        (value) => value === "quality_failure"
      ).length;
      const singleCaseBlockerCount = result.blockers.filter(Boolean).length;
      return {
        group: summary.group,
        identity: summary.identity,
        directUseCount,
        minorIssueCount,
        qualityFailureCount,
        singleCaseBlockerCount,
        pairedWinCount: result.pairedWins,
        technicalEffectiveValidCount: summary.effectiveValidCount,
        technicalP90Ms: summary.latency.p90Ms,
        gatePassed:
          directUseCount >= 6 &&
          minorIssueCount <= 2 &&
          qualityFailureCount === 0 &&
          singleCaseBlockerCount === 0
      } satisfies Gi088RuntimeContractReviewGroupResult;
    });
    const fixedOrder = new Map(
      GI088_RUNTIME_CONTRACT_GROUP_ORDER.map((group, index) => [group, index])
    );
    const winningGroup = groupResults
      .filter((result) => result.gatePassed)
      .sort((left, right) =>
        right.directUseCount - left.directUseCount ||
        right.pairedWinCount - left.pairedWinCount ||
        right.technicalEffectiveValidCount - left.technicalEffectiveValidCount ||
        (left.technicalP90Ms ?? Number.POSITIVE_INFINITY) -
          (right.technicalP90Ms ?? Number.POSITIVE_INFINITY) ||
        (fixedOrder.get(left.group) ?? 99) - (fixedOrder.get(right.group) ?? 99)
      )[0]?.group ?? null;
    const decisionsSha256 = sha256(stableJson(saved));
    const receiptPayload = {
      schemaVersion: "1.0",
      toolVersion: GI088_RUNTIME_CONTRACT_REVIEW_TOOL_VERSION,
      stage: GI088_RUNTIME_CONTRACT_REVIEW_STAGE,
      status: "sealed",
      reportFingerprint: current.report.reportFingerprint,
      diagnosticFingerprint: current.report.diagnosticFingerprint,
      reviewCount: 8,
      responseCount: (current.cards[0]?.right ? 16 : 8) as 8 | 16,
      decisionCount: 8,
      sourceReportSha256: current.sourceReportSha256,
      toolSourceSha256,
      bundleSha256,
      decisionsSha256,
      groupResults,
      winningGroup,
      gate: {
        passed: winningGroup !== null,
        requiredDirectUseMinimum: 6,
        allowedMinorIssueMaximum: 2,
        allowedQualityFailureMaximum: 0,
        allowedSingleCaseBlockerMaximum: 0
      },
      reviewer: "product_owner",
      finalizedAt: now(),
      modelCalls: 0,
      databaseWrites: 0,
      externalUploads: 0,
      telemetryEvents: 0
    } as const;
    const receipt = {
      ...receiptPayload,
      receiptSha256: sha256(stableJson(receiptPayload))
    } satisfies Gi088RuntimeContractReviewReceiptV1;
    await atomicWrite(receiptPath, receipt, privateRoot);
    return receipt;
  }

  return { load, saveDecision, finalize };
}

const defaultService = createGi088RuntimeContractReviewService();

export const loadGi088RuntimeContractFinalEight = () => defaultService.load();
export const saveGi088RuntimeContractFinalEightDecision = (
  input: Parameters<typeof defaultService.saveDecision>[0]
) => defaultService.saveDecision(input);
export const finalizeGi088RuntimeContractFinalEight = () =>
  defaultService.finalize();
