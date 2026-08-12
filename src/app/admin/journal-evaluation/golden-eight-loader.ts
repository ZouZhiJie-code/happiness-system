import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  GOLDEN_EIGHT_REPLACEMENT_ROUND_ID,
  goldenEightReplacementSourceSha256,
  loadGoldenEightReplacementCards,
  type GoldenEightReplacementCard
} from "@/app/admin/journal-evaluation/golden-eight-replacements";

import {
  assertLocalJournalEvaluationEnvironment,
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/private-loader";

export { isLocalJournalEvaluationEnabled, isLocalJournalEvaluationRequest };

export const GOLDEN_EIGHT_ROUND_ID = GOLDEN_EIGHT_REPLACEMENT_ROUND_ID;

const PRIVATE_ROOT = resolve(
  process.cwd(),
  "artifacts/journal-generation-evaluation/.private/formal/golden-eight"
);
const DECISIONS_PATH = resolve(PRIVATE_ROOT, "replacement-decisions.json");
const RECEIPT_PATH = resolve(PRIVATE_ROOT, "replacement-receipt.json");

export type GoldenEightVerdict =
  | "ready_to_use"
  | "minor_issue"
  | "quality_failure"
  | "single_blocker";

export interface GoldenEightCard {
  caseId: string;
  label: string;
  mode: "帮我记" | "陪我聊";
  title: string;
  content: string;
}

export interface GoldenEightDecision {
  caseId: string;
  verdict: GoldenEightVerdict;
  reason: string;
  reviewer: "product_owner";
  updatedAt: string;
}

export interface GoldenEightReceipt {
  schemaVersion: "1.0";
  roundId: string;
  status: "sealed";
  cardCount: 8;
  decisionCount: 8;
  sourceSha256: string;
  decisionsSha256: string;
  verdicts: Record<GoldenEightVerdict, number>;
  reviewer: "product_owner";
  finalizedAt: string;
  carryForward: {
    cardCount: 32;
    status: "accepted_previous_round";
  };
  modelCalls: 0;
  databaseWrites: 0;
  externalUploads: 0;
}

function assertPrivatePath() {
  assertLocalJournalEvaluationEnvironment();
}

function asCard(card: GoldenEightReplacementCard): GoldenEightCard {
  return card;
}

async function readDecisions() {
  try {
    const raw = await readFile(DECISIONS_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("GOLDEN_EIGHT_DECISIONS_INVALID");
    return parsed as GoldenEightDecision[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeDecisions(decisions: GoldenEightDecision[]) {
  await mkdir(PRIVATE_ROOT, { recursive: true, mode: 0o700 });
  const temporaryPath = resolve(PRIVATE_ROOT, `.decisions.${process.pid}.${Date.now()}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(decisions, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporaryPath, DECISIONS_PATH);
  await chmod(DECISIONS_PATH, 0o600);
}

async function readReceipt() {
  try {
    return JSON.parse(await readFile(RECEIPT_PATH, "utf8")) as GoldenEightReceipt;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeReceipt(receipt: GoldenEightReceipt) {
  await mkdir(PRIVATE_ROOT, { recursive: true, mode: 0o700 });
  const temporaryPath = resolve(PRIVATE_ROOT, `.receipt.${process.pid}.${Date.now()}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporaryPath, RECEIPT_PATH);
  await chmod(RECEIPT_PATH, 0o600);
}

export async function loadGoldenEightReview() {
  assertPrivatePath();
  const cards = (await loadGoldenEightReplacementCards()).map(asCard);
  if (cards.length !== 8) throw new Error("GOLDEN_EIGHT_CARD_COUNT_INVALID");
  const decisions = await readDecisions();
  return {
    roundId: GOLDEN_EIGHT_ROUND_ID,
    sourceSha256: goldenEightReplacementSourceSha256(cards),
    cards,
    decisions
  };
}

export async function saveGoldenEightDecision(input: {
  caseId: string;
  verdict: GoldenEightVerdict;
  reason: string;
}) {
  const review = await loadGoldenEightReview();
  const card = review.cards.find((item) => item.caseId === input.caseId);
  if (!card) throw new Error("GOLDEN_EIGHT_CASE_NOT_FOUND");
  const reason = input.reason.trim();
  if (input.verdict !== "ready_to_use" && reason.length < 8) {
    throw new Error("GOLDEN_EIGHT_REASON_REQUIRED");
  }
  if (reason.length > 300) throw new Error("GOLDEN_EIGHT_REASON_TOO_LONG");
  const next: GoldenEightDecision = {
    caseId: input.caseId,
    verdict: input.verdict,
    reason,
    reviewer: "product_owner",
    updatedAt: new Date().toISOString()
  };
  const decisions = review.decisions.filter((item) => item.caseId !== input.caseId);
  decisions.push(next);
  decisions.sort((left, right) => left.caseId.localeCompare(right.caseId));
  await writeDecisions(decisions);
  return { ...review, decisions };
}

export async function finalizeGoldenEightReview(): Promise<GoldenEightReceipt> {
  const review = await loadGoldenEightReview();
  const expectedIds = new Set(review.cards.map((card) => card.caseId));
  const actualIds = new Set(review.decisions.map((decision) => decision.caseId));
  if (review.decisions.length !== review.cards.length || actualIds.size !== expectedIds.size) {
    throw new Error("GOLDEN_EIGHT_INCOMPLETE");
  }
  if ([...expectedIds].some((caseId) => !actualIds.has(caseId))) {
    throw new Error("GOLDEN_EIGHT_INCOMPLETE");
  }
  for (const decision of review.decisions) {
    if (decision.verdict !== "ready_to_use" && decision.reason.trim().length < 8) {
      throw new Error("GOLDEN_EIGHT_REASON_REQUIRED");
    }
  }
  const decisionsSha256 = createHash("sha256")
    .update(JSON.stringify(review.decisions))
    .digest("hex");
  const previousReceipt = await readReceipt();
  if (previousReceipt && previousReceipt.decisionsSha256 !== decisionsSha256) {
    throw new Error("GOLDEN_EIGHT_RECEIPT_IMMUTABLE");
  }
  const verdicts: Record<GoldenEightVerdict, number> = {
    ready_to_use: 0,
    minor_issue: 0,
    quality_failure: 0,
    single_blocker: 0
  };
  for (const decision of review.decisions) verdicts[decision.verdict] += 1;
  const receipt: GoldenEightReceipt = previousReceipt ?? {
    schemaVersion: "1.0",
    roundId: review.roundId,
    status: "sealed",
    cardCount: 8,
    decisionCount: 8,
    sourceSha256: review.sourceSha256,
    decisionsSha256,
    verdicts,
    reviewer: "product_owner",
    finalizedAt: new Date().toISOString(),
    carryForward: { cardCount: 32, status: "accepted_previous_round" },
    modelCalls: 0,
    databaseWrites: 0,
    externalUploads: 0
  };
  await writeReceipt(receipt);
  return receipt;
}
