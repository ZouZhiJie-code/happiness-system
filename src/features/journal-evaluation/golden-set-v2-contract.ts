import { z } from "zod";

export const GOLDEN_SET_V2_CONTRACT_VERSION = "2.0" as const;

export const GOLDEN_SET_V2_DIMENSIONS = [
  "factual_fidelity",
  "important_content_coverage",
  "source_and_date_boundary",
  "structure_and_readability",
  "user_voice_preservation",
  "update_and_manual_edit_protection"
] as const;

export const GOLDEN_SET_V2_SINGLE_CASE_BLOCKERS = [
  "fabricated_fact",
  "cross_user_contamination",
  "cross_date_contamination",
  "privacy_leak",
  "manual_edit_overwrite"
] as const;

export const GOLDEN_SET_V2_SPECIAL_BEHAVIORS = [
  "event_card_edited",
  "daily_journal_stale",
  "turn_recovered",
  "manual_edit_preserved"
] as const;

const isoDateTimeSchema = z.string().datetime({ offset: true });
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const nonEmptyTextSchema = z.string().trim().min(1);
const uuidSchema = z.string().uuid();

export const goldenSetV2CaseIdSchema = z.string().regex(/^jgv2_[a-f0-9]{32}$/u);
export const goldenSetV2AuthorizationIdSchema = z.string().regex(/^jgvauth_[a-f0-9]{32}$/u);
export const goldenSetV2ScoreSchema = z.union([
  z.literal(2),
  z.literal(1),
  z.literal(0),
  z.literal("N/A")
]);
export const goldenSetV2BlockerSchema = z.enum(GOLDEN_SET_V2_SINGLE_CASE_BLOCKERS);
export const goldenSetV2DimensionSchema = z.enum(GOLDEN_SET_V2_DIMENSIONS);

export type GoldenSetV2CaseId = z.infer<typeof goldenSetV2CaseIdSchema>;
export type GoldenSetV2AuthorizationId = z.infer<typeof goldenSetV2AuthorizationIdSchema>;
export type GoldenSetV2Score = z.infer<typeof goldenSetV2ScoreSchema>;
export type GoldenSetV2Dimension = z.infer<typeof goldenSetV2DimensionSchema>;
export type GoldenSetV2SingleCaseBlocker = z.infer<typeof goldenSetV2BlockerSchema>;

function opaqueId(prefix: "jgv2" | "jgvauth", uuidFactory: () => string) {
  const uuid = uuidSchema.parse(uuidFactory()).toLowerCase().replaceAll("-", "");
  return `${prefix}_${uuid}`;
}

/**
 * Case IDs are random and carry no user, date, session, or content-derived material.
 * The injectable factory keeps the contract deterministic in unit tests.
 */
export function createGoldenSetV2CaseId(
  uuidFactory: () => string = () => globalThis.crypto.randomUUID()
): GoldenSetV2CaseId {
  return goldenSetV2CaseIdSchema.parse(opaqueId("jgv2", uuidFactory));
}

export function createGoldenSetV2AuthorizationId(
  uuidFactory: () => string = () => globalThis.crypto.randomUUID()
): GoldenSetV2AuthorizationId {
  return goldenSetV2AuthorizationIdSchema.parse(opaqueId("jgvauth", uuidFactory));
}

export const goldenSetV2DimensionScoresSchema = z.object({
  factual_fidelity: goldenSetV2ScoreSchema,
  important_content_coverage: goldenSetV2ScoreSchema,
  source_and_date_boundary: goldenSetV2ScoreSchema,
  structure_and_readability: goldenSetV2ScoreSchema,
  user_voice_preservation: goldenSetV2ScoreSchema,
  update_and_manual_edit_protection: goldenSetV2ScoreSchema
}).strict();

export type GoldenSetV2DimensionScores = z.infer<typeof goldenSetV2DimensionScoresSchema>;

export const goldenSetV2PrivateCaseSchema = z.object({
  schemaVersion: z.literal(GOLDEN_SET_V2_CONTRACT_VERSION),
  caseId: goldenSetV2CaseIdSchema,
  caseVersion: nonEmptyTextSchema,
  authorizationId: goldenSetV2AuthorizationIdSchema,
  sourceType: z.literal("authorized_real"),
  recordMode: z.enum(["capture", "chat"]),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  privateSourceRefs: z.object({
    rootSessionRef: nonEmptyTextSchema,
    userTurnRefs: z.array(nonEmptyTextSchema).min(1),
    eventEntryRefs: z.array(nonEmptyTextSchema).min(1),
    dailyEntryRef: nonEmptyTextSchema
  }).strict(),
  sourceSha256: sha256Schema,
  contentBundleSha256: sha256Schema,
  specialBehaviors: z.array(z.enum(GOLDEN_SET_V2_SPECIAL_BEHAVIORS)),
  status: z.enum(["candidate", "reviewed", "golden", "withdrawn", "quarantined"]),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
}).strict().superRefine((evaluationCase, context) => {
  if (new Set(evaluationCase.privateSourceRefs.userTurnRefs).size
    !== evaluationCase.privateSourceRefs.userTurnRefs.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["privateSourceRefs", "userTurnRefs"],
      message: "GOLDEN_SET_V2_USER_TURN_REFS_MUST_BE_UNIQUE"
    });
  }
  if (new Set(evaluationCase.privateSourceRefs.eventEntryRefs).size
    !== evaluationCase.privateSourceRefs.eventEntryRefs.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["privateSourceRefs", "eventEntryRefs"],
      message: "GOLDEN_SET_V2_EVENT_ENTRY_REFS_MUST_BE_UNIQUE"
    });
  }
  if (new Set(evaluationCase.specialBehaviors).size !== evaluationCase.specialBehaviors.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["specialBehaviors"],
      message: "GOLDEN_SET_V2_SPECIAL_BEHAVIORS_MUST_BE_UNIQUE"
    });
  }
});

export type GoldenSetV2PrivateCase = z.infer<typeof goldenSetV2PrivateCaseSchema>;

const naReasonsSchema = z.record(nonEmptyTextSchema).default({});

export const goldenSetV2ReviewSchema = z.object({
  schemaVersion: z.literal(GOLDEN_SET_V2_CONTRACT_VERSION),
  reviewId: nonEmptyTextSchema,
  caseId: goldenSetV2CaseIdSchema,
  caseContentSha256: sha256Schema,
  reviewerRole: z.enum(["codex", "product_owner"]),
  reviewerRef: nonEmptyTextSchema,
  reviewedAt: isoDateTimeSchema,
  scores: goldenSetV2DimensionScoresSchema,
  naReasons: naReasonsSchema,
  blockers: z.array(goldenSetV2BlockerSchema),
  verdict: z.enum(["pass", "minor", "fail"]),
  rationale: nonEmptyTextSchema
}).strict().superRefine((review, context) => {
  const uniqueBlockers = new Set(review.blockers);
  if (uniqueBlockers.size !== review.blockers.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["blockers"],
      message: "GOLDEN_SET_V2_BLOCKERS_MUST_BE_UNIQUE"
    });
  }

  const naDimensions = GOLDEN_SET_V2_DIMENSIONS.filter((dimension) => review.scores[dimension] === "N/A");
  const unknownReasons = Object.keys(review.naReasons).filter(
    (dimension) => !GOLDEN_SET_V2_DIMENSIONS.includes(dimension as GoldenSetV2Dimension)
  );
  if (unknownReasons.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["naReasons"],
      message: "GOLDEN_SET_V2_NA_REASON_DIMENSION_UNKNOWN"
    });
  }
  for (const dimension of GOLDEN_SET_V2_DIMENSIONS) {
    const hasReason = Boolean(review.naReasons[dimension]?.trim());
    if (review.scores[dimension] === "N/A" && !hasReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["naReasons", dimension],
        message: "GOLDEN_SET_V2_NA_REASON_REQUIRED"
      });
    }
    if (review.scores[dimension] !== "N/A" && hasReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["naReasons", dimension],
        message: "GOLDEN_SET_V2_NA_REASON_WITHOUT_NA_SCORE"
      });
    }
  }
  if (naDimensions.length === GOLDEN_SET_V2_DIMENSIONS.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scores"],
      message: "GOLDEN_SET_V2_REVIEW_REQUIRES_APPLICABLE_DIMENSION"
    });
  }

  const expectedVerdict = deriveGoldenSetV2Verdict(review.scores, review.blockers);
  if (review.verdict !== expectedVerdict) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["verdict"],
      message: `GOLDEN_SET_V2_VERDICT_MUST_BE_${expectedVerdict.toUpperCase()}`
    });
  }
});

export type GoldenSetV2Review = z.infer<typeof goldenSetV2ReviewSchema>;

export function deriveGoldenSetV2Verdict(
  scores: GoldenSetV2DimensionScores,
  blockers: readonly GoldenSetV2SingleCaseBlocker[]
): "pass" | "minor" | "fail" {
  if (blockers.length > 0 || Object.values(scores).some((score) => score === 0)) return "fail";
  if (Object.values(scores).some((score) => score === 1)) return "minor";
  return "pass";
}

export const goldenSetV2AuthorizationSchema = z.object({
  schemaVersion: z.literal(GOLDEN_SET_V2_CONTRACT_VERSION),
  authorizationId: goldenSetV2AuthorizationIdSchema,
  caseId: goldenSetV2CaseIdSchema,
  privateSubjectRef: nonEmptyTextSchema,
  accountClass: z.literal("internal"),
  scope: z.literal("full_trajectory_review"),
  externalModelProcessingAllowed: z.literal(false),
  consentPolicyVersion: nonEmptyTextSchema,
  consentAt: isoDateTimeSchema,
  consentCheckedAt: isoDateTimeSchema,
  authorizedAt: isoDateTimeSchema,
  authorizedBy: nonEmptyTextSchema,
  expiresAt: isoDateTimeSchema.nullable(),
  withdrawnAt: isoDateTimeSchema.nullable()
}).strict().superRefine((authorization, context) => {
  const consentAt = Date.parse(authorization.consentAt);
  const consentCheckedAt = Date.parse(authorization.consentCheckedAt);
  const authorizedAt = Date.parse(authorization.authorizedAt);
  if (consentCheckedAt < consentAt || authorizedAt < consentCheckedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["authorizedAt"],
      message: "GOLDEN_SET_V2_AUTHORIZATION_TIMELINE_INVALID"
    });
  }
  if (authorization.expiresAt && Date.parse(authorization.expiresAt) <= authorizedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expiresAt"],
      message: "GOLDEN_SET_V2_AUTHORIZATION_EXPIRY_INVALID"
    });
  }
  if (authorization.withdrawnAt && Date.parse(authorization.withdrawnAt) < authorizedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["withdrawnAt"],
      message: "GOLDEN_SET_V2_AUTHORIZATION_WITHDRAWAL_INVALID"
    });
  }
});

export type GoldenSetV2Authorization = z.infer<typeof goldenSetV2AuthorizationSchema>;

export const goldenSetV2AuthorizedSourceSchema = z.object({
  caseId: goldenSetV2CaseIdSchema,
  authorization: goldenSetV2AuthorizationSchema,
  source: z.object({
    rootSessionRef: z.string().trim().min(1).max(191),
    userIdRef: z.string().trim().min(1).max(191),
    username: z.string().trim().min(1).max(191),
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    recordMode: z.enum(["capture", "chat"])
  }).strict()
}).strict().superRefine((mapping, context) => {
  if (mapping.caseId !== mapping.authorization.caseId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["authorization", "caseId"],
      message: "GOLDEN_SET_V2_AUTHORIZATION_CASE_ID_MISMATCH"
    });
  }
  if (mapping.source.userIdRef !== mapping.authorization.privateSubjectRef) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["authorization", "privateSubjectRef"],
      message: "GOLDEN_SET_V2_AUTHORIZATION_SUBJECT_MISMATCH"
    });
  }
});

export type GoldenSetV2AuthorizedSource = z.infer<typeof goldenSetV2AuthorizedSourceSchema>;

export const goldenSetV2AuthorizedSourceCollectionSchema = z.array(
  goldenSetV2AuthorizedSourceSchema
).max(30).superRefine((mappings, context) => {
  for (const [path, values] of [
    ["caseId", mappings.map((mapping) => mapping.caseId)],
    ["authorizationId", mappings.map((mapping) => mapping.authorization.authorizationId)],
    ["rootSessionRef", mappings.map((mapping) => mapping.source.rootSessionRef)]
  ] as const) {
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message: `GOLDEN_SET_V2_AUTHORIZED_SOURCE_${path.toUpperCase()}_MUST_BE_UNIQUE`
      });
    }
  }
});

export function isGoldenSetV2AuthorizedSourceActive(
  mapping: GoldenSetV2AuthorizedSource,
  checkedAt: Date
) {
  const authorization = mapping.authorization;
  return Date.parse(authorization.authorizedAt) <= checkedAt.getTime()
    && authorization.withdrawnAt === null
    && (
      authorization.expiresAt === null
      || Date.parse(authorization.expiresAt) > checkedAt.getTime()
    );
}

export const goldenSetV2CurrentConsentSnapshotSchema = z.object({
  privateSubjectRef: nonEmptyTextSchema,
  subjectExists: z.boolean(),
  policyVersion: nonEmptyTextSchema.nullable(),
  consentAt: isoDateTimeSchema.nullable(),
  revokedAt: isoDateTimeSchema.nullable(),
  checkedAt: isoDateTimeSchema
}).strict().superRefine((snapshot, context) => {
  if (!snapshot.subjectExists && (snapshot.policyVersion || snapshot.consentAt || snapshot.revokedAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "GOLDEN_SET_V2_DELETED_SUBJECT_MUST_NOT_CARRY_CONSENT",
      path: ["subjectExists"]
    });
  }
});

export type GoldenSetV2CurrentConsentSnapshot = z.infer<typeof goldenSetV2CurrentConsentSnapshotSchema>;

export const GOLDEN_SET_V2_RECONCILIATION_REASONS = [
  "subject_reference_mismatch",
  "account_deleted",
  "sample_authorization_not_started",
  "sample_authorization_withdrawn",
  "sample_authorization_expired",
  "consent_missing",
  "consent_revoked",
  "consent_version_changed",
  "consent_epoch_changed"
] as const;

export const goldenSetV2ReconciliationReceiptSchema = z.object({
  schemaVersion: z.literal(GOLDEN_SET_V2_CONTRACT_VERSION),
  caseId: goldenSetV2CaseIdSchema,
  authorizationId: goldenSetV2AuthorizationIdSchema,
  checkedAt: isoDateTimeSchema,
  status: z.enum(["eligible", "withdrawn", "quarantined"]),
  reasons: z.array(z.enum(GOLDEN_SET_V2_RECONCILIATION_REASONS)),
  actions: z.object({
    contentReadAllowed: z.boolean(),
    includeInActiveSet: z.boolean(),
    quarantinePrivateContent: z.boolean(),
    retainPublicReceiptOnly: z.boolean(),
    replacementRequired: z.boolean()
  }).strict()
}).strict();

export type GoldenSetV2ReconciliationReceipt = z.infer<typeof goldenSetV2ReconciliationReceiptSchema>;

export function reconcileGoldenSetV2Authorization(input: {
  authorization: GoldenSetV2Authorization;
  currentConsent: GoldenSetV2CurrentConsentSnapshot;
}): GoldenSetV2ReconciliationReceipt {
  const authorization = goldenSetV2AuthorizationSchema.parse(input.authorization);
  const currentConsent = goldenSetV2CurrentConsentSnapshotSchema.parse(input.currentConsent);
  const reasons: Array<(typeof GOLDEN_SET_V2_RECONCILIATION_REASONS)[number]> = [];

  if (authorization.privateSubjectRef !== currentConsent.privateSubjectRef) {
    reasons.push("subject_reference_mismatch");
  }
  if (!currentConsent.subjectExists) reasons.push("account_deleted");
  if (Date.parse(authorization.authorizedAt) > Date.parse(currentConsent.checkedAt)) {
    reasons.push("sample_authorization_not_started");
  }
  if (authorization.withdrawnAt) reasons.push("sample_authorization_withdrawn");
  if (
    authorization.expiresAt
    && Date.parse(authorization.expiresAt) <= Date.parse(currentConsent.checkedAt)
  ) {
    reasons.push("sample_authorization_expired");
  }
  if (currentConsent.subjectExists && (!currentConsent.policyVersion || !currentConsent.consentAt)) {
    reasons.push("consent_missing");
  }
  if (currentConsent.revokedAt) reasons.push("consent_revoked");
  if (
    currentConsent.policyVersion
    && currentConsent.policyVersion !== authorization.consentPolicyVersion
  ) {
    reasons.push("consent_version_changed");
  }
  if (
    currentConsent.consentAt
    && Date.parse(currentConsent.consentAt) !== Date.parse(authorization.consentAt)
  ) {
    reasons.push("consent_epoch_changed");
  }

  const uniqueReasons = [...new Set(reasons)];
  const eligible = uniqueReasons.length === 0;
  const explicitlyWithdrawn = uniqueReasons.some((reason) =>
    reason === "account_deleted"
      || reason === "sample_authorization_withdrawn"
      || reason === "consent_revoked"
  );

  return goldenSetV2ReconciliationReceiptSchema.parse({
    schemaVersion: GOLDEN_SET_V2_CONTRACT_VERSION,
    caseId: authorization.caseId,
    authorizationId: authorization.authorizationId,
    checkedAt: currentConsent.checkedAt,
    status: eligible ? "eligible" : explicitlyWithdrawn ? "withdrawn" : "quarantined",
    reasons: uniqueReasons,
    actions: {
      contentReadAllowed: eligible,
      includeInActiveSet: eligible,
      quarantinePrivateContent: !eligible,
      retainPublicReceiptOnly: !eligible,
      replacementRequired: !eligible
    }
  });
}

export const goldenSetV2CheckpointDecisionSchema = z.object({
  checkpoint: z.union([z.literal(10), z.literal(30)]),
  decision: z.enum(["approved", "rejected"]),
  decidedByRole: z.literal("product_owner"),
  decidedByRef: nonEmptyTextSchema,
  decidedAt: isoDateTimeSchema,
  reason: nonEmptyTextSchema
}).strict();

export type GoldenSetV2CheckpointDecision = z.infer<typeof goldenSetV2CheckpointDecisionSchema>;

export const goldenSetV2ProductGateInputSchema = z.object({
  eligibleCaseCount: z.number().int().nonnegative(),
  reviewedCaseCount: z.number().int().nonnegative(),
  unresolvedReconciliationCount: z.number().int().nonnegative(),
  singleCaseBlockerCount: z.number().int().nonnegative(),
  checkpointDecisions: z.array(goldenSetV2CheckpointDecisionSchema)
}).strict().superRefine((input, context) => {
  if (input.reviewedCaseCount > input.eligibleCaseCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reviewedCaseCount"],
      message: "GOLDEN_SET_V2_REVIEWED_COUNT_EXCEEDS_ELIGIBLE_COUNT"
    });
  }
  const checkpoints = input.checkpointDecisions.map((decision) => decision.checkpoint);
  if (new Set(checkpoints).size !== checkpoints.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointDecisions"],
      message: "GOLDEN_SET_V2_CHECKPOINT_DECISIONS_MUST_BE_UNIQUE"
    });
  }
  for (const decision of input.checkpointDecisions) {
    if (input.reviewedCaseCount < decision.checkpoint) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointDecisions"],
        message: "GOLDEN_SET_V2_CHECKPOINT_DECISION_REQUIRES_REVIEW_COUNT"
      });
    }
  }
  const checkpoint10 = input.checkpointDecisions.find((decision) => decision.checkpoint === 10);
  const checkpoint30 = input.checkpointDecisions.find((decision) => decision.checkpoint === 30);
  if (checkpoint30 && checkpoint10?.decision !== "approved") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointDecisions"],
      message: "GOLDEN_SET_V2_CHECKPOINT_10_APPROVAL_REQUIRED"
    });
  }
});

export type GoldenSetV2ProductGateInput = z.infer<typeof goldenSetV2ProductGateInputSchema>;

export const GOLDEN_SET_V2_CORPUS_GATE_STATUSES = [
  "reconciliation_required",
  "collecting_to_10",
  "reviewing_to_10",
  "awaiting_product_checkpoint_10",
  "checkpoint_10_rejected",
  "collecting_to_30",
  "reviewing_to_30",
  "awaiting_product_checkpoint_30",
  "checkpoint_30_rejected",
  "ready_to_seal"
] as const;

export function evaluateGoldenSetV2ProductGate(rawInput: GoldenSetV2ProductGateInput) {
  const input = goldenSetV2ProductGateInputSchema.parse(rawInput);
  const checkpoint10 = input.checkpointDecisions.find((decision) => decision.checkpoint === 10);
  const checkpoint30 = input.checkpointDecisions.find((decision) => decision.checkpoint === 30);
  let corpusStatus: (typeof GOLDEN_SET_V2_CORPUS_GATE_STATUSES)[number];

  if (input.unresolvedReconciliationCount > 0) corpusStatus = "reconciliation_required";
  else if (input.eligibleCaseCount < 10) corpusStatus = "collecting_to_10";
  else if (input.reviewedCaseCount < 10) corpusStatus = "reviewing_to_10";
  else if (!checkpoint10) corpusStatus = "awaiting_product_checkpoint_10";
  else if (checkpoint10.decision === "rejected") corpusStatus = "checkpoint_10_rejected";
  else if (input.eligibleCaseCount < 30) corpusStatus = "collecting_to_30";
  else if (input.reviewedCaseCount < 30) corpusStatus = "reviewing_to_30";
  else if (!checkpoint30) corpusStatus = "awaiting_product_checkpoint_30";
  else if (checkpoint30.decision === "rejected") corpusStatus = "checkpoint_30_rejected";
  else corpusStatus = "ready_to_seal";

  return {
    corpusStatus,
    corpusReadyToSeal: corpusStatus === "ready_to_seal",
    productQualityStatus: input.singleCaseBlockerCount > 0
      ? "blocked_by_single_case" as const
      : "clear" as const,
    nextCheckpoint: corpusStatus === "ready_to_seal"
      ? null
      : checkpoint10?.decision === "approved" ? 30 as const : 10 as const
  };
}

export const goldenSetV2PublicCaseReceiptSchema = z.object({
  caseId: goldenSetV2CaseIdSchema,
  sourceSha256: sha256Schema,
  status: z.enum(["candidate", "reviewed", "golden", "withdrawn"]),
  verdict: z.enum(["pass", "minor", "fail"]).nullable(),
  blockers: z.array(goldenSetV2BlockerSchema)
}).strict();

export const goldenSetV2PublicManifestSchema = z.object({
  schemaVersion: z.literal(GOLDEN_SET_V2_CONTRACT_VERSION),
  datasetId: nonEmptyTextSchema,
  status: z.enum(["foundation_ready", "collecting", "checkpoint_10_pending", "sealed", "partial"]),
  privacyClassification: z.literal("public_deidentified_receipts_only"),
  contract: z.object({
    version: z.literal(GOLDEN_SET_V2_CONTRACT_VERSION),
    path: z.literal("src/features/journal-evaluation/golden-set-v2-contract.ts"),
    sha256: sha256Schema
  }).strict(),
  expectedCaseCount: z.literal(30),
  minimumCoverage: z.object({
    capture: z.literal(5),
    chat: z.literal(5),
    specialBehavior: z.literal(5)
  }).strict(),
  counts: z.object({
    candidates: z.number().int().nonnegative(),
    reviewed: z.number().int().nonnegative(),
    golden: z.number().int().nonnegative(),
    withdrawn: z.number().int().nonnegative(),
    blockers: z.number().int().nonnegative()
  }).strict(),
  scoreScale: z.tuple([z.literal(2), z.literal(1), z.literal(0), z.literal("N/A")]),
  dimensions: z.array(goldenSetV2DimensionSchema).length(GOLDEN_SET_V2_DIMENSIONS.length),
  singleCaseBlockers: z.array(goldenSetV2BlockerSchema).length(GOLDEN_SET_V2_SINGLE_CASE_BLOCKERS.length),
  cases: z.array(goldenSetV2PublicCaseReceiptSchema),
  rawContentIncluded: z.literal(false),
  productionContentReadCount: z.number().int().nonnegative(),
  modelCallCount: z.literal(0)
}).strict().superRefine((manifest, context) => {
  if (new Set(manifest.dimensions).size !== GOLDEN_SET_V2_DIMENSIONS.length
    || GOLDEN_SET_V2_DIMENSIONS.some((dimension) => !manifest.dimensions.includes(dimension))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dimensions"],
      message: "GOLDEN_SET_V2_MANIFEST_DIMENSIONS_INCOMPLETE"
    });
  }
  if (new Set(manifest.singleCaseBlockers).size !== GOLDEN_SET_V2_SINGLE_CASE_BLOCKERS.length
    || GOLDEN_SET_V2_SINGLE_CASE_BLOCKERS.some((blocker) => !manifest.singleCaseBlockers.includes(blocker))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["singleCaseBlockers"],
      message: "GOLDEN_SET_V2_MANIFEST_BLOCKERS_INCOMPLETE"
    });
  }
  if (manifest.counts.candidates !== manifest.cases.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["counts", "candidates"],
      message: "GOLDEN_SET_V2_MANIFEST_CASE_COUNT_MISMATCH"
    });
  }
  if (manifest.counts.reviewed > manifest.counts.candidates
    || manifest.counts.golden > manifest.counts.reviewed
    || manifest.counts.withdrawn > manifest.counts.candidates) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["counts"],
      message: "GOLDEN_SET_V2_MANIFEST_COUNT_ORDER_INVALID"
    });
  }
  if (new Set(manifest.cases.map((evaluationCase) => evaluationCase.caseId)).size
    !== manifest.cases.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cases"],
      message: "GOLDEN_SET_V2_MANIFEST_CASE_IDS_MUST_BE_UNIQUE"
    });
  }
});

export type GoldenSetV2PublicManifest = z.infer<typeof goldenSetV2PublicManifestSchema>;

export const GOLDEN_SET_V2_PUBLIC_SMALL_CELL_THRESHOLD = 3 as const;

const goldenSetV2PublicDistributionCountShape = {
  total: z.number().int().nonnegative(),
  internal: z.number().int().nonnegative(),
  capture: z.number().int().nonnegative(),
  chat: z.number().int().nonnegative()
};

function validateGoldenSetV2PublicDistributionCounts(
  bucket: { total: number; internal: number; capture: number; chat: number },
  context: z.RefinementCtx
) {
  if (bucket.internal > bucket.total || bucket.capture + bucket.chat !== bucket.total) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "GOLDEN_SET_V2_PUBLIC_DISTRIBUTION_COUNT_INVALID"
    });
  }
}

export const goldenSetV2PublicMetadataDistributionSchema = z.object({
  privacyThreshold: z.literal(GOLDEN_SET_V2_PUBLIC_SMALL_CELL_THRESHOLD),
  byDay: z.array(
    z.object({
      ...goldenSetV2PublicDistributionCountShape,
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
      total: z.number().int().min(GOLDEN_SET_V2_PUBLIC_SMALL_CELL_THRESHOLD)
    }).strict().superRefine(validateGoldenSetV2PublicDistributionCounts)
  ),
  suppressedDayBucketCount: z.number().int().nonnegative(),
  byMonth: z.array(
    z.object({
      ...goldenSetV2PublicDistributionCountShape,
      month: z.string().regex(/^\d{4}-\d{2}$/u),
      total: z.number().int().min(GOLDEN_SET_V2_PUBLIC_SMALL_CELL_THRESHOLD)
    }).strict().superRefine(validateGoldenSetV2PublicDistributionCounts)
  ),
  suppressedMonthBucketCount: z.number().int().nonnegative()
}).strict();
